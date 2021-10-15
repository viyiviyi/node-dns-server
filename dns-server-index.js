const https = require('https');
const named = require('lts-dns-server-lib');
const server = named.createServer();
const NodeCache = require("node-cache");
let serverOption = Object.assign({
    ttl: 0,
    port: 9053,
    cacheTime: 300,
    DoHJSONServers: [
        'https://223.5.5.5/resolve'
    ]
}, require('./server-config.json'));
let serverHost = {}

const dnsCache = new NodeCache({ stdTTL: serverOption.cacheTime, checkperiod: 30 });
let dnsTypeFrom = {
    A: {
        resolveApi: 1
    },
    AAAA: {
        resolveApi: 28
    },
    CNAME: {
        resolveApi: 5
    },
    NS: {
        resolveApi: 2
    },
    MX: {
    },
    SOA: {
        resolveApi: 6
    },
    SRV: {
    },
    TXT: {
        resolveApi: 16
    }
}

async function getHost(domain, type) {
    serverHost = require('./server-host.json');
    if (!serverHost) return;
    let types = serverHost[type];
    if (!types) return;
    let ips = types[domain];
    if (!ips || ips.length == 0) {
        let typeKeys = Object.keys(types);
        domain = typeKeys.find(f => /^\*\./.test(f) && domain.indexOf(f.substring(2)) != -1)
        if (typeKeys) ips = types[domain];
        if (!ips || ips.length == 0) return;
    }
    if (typeof ips == 'string') return [createRecord(ips, type)];
    else return ips.map(ip => createRecord(ip, type));
}

async function getCache(domain, type) {
    return dnsCache.get(type + '-' + domain)
}

async function setCache(domain, Records, type, ttl) {
    dnsCache.set(type + '-' + domain, Records, ttl)
}

async function getDnsDoH(serverName, domain, type) {
    let resolveType = dnsTypeFrom[type].resolveApi
    if (!resolveType) return [];
    return await new Promise((res, rej) => {
        https.get(serverName + '?name=' + domain + '&type=' + resolveType, function (data) {
            var str = "";
            data.on("data", function (chunk) {
                str += chunk;
            })
            data.on("end", function () {
                if (/^\{[\w\W]*\}$/.test(str))
                    res(JSON.parse(str))
                res({ Status: 1 })
            })
            data.on("error", function (err) {
                rej(err)
            })
        })
    })
}

async function getDnsByServer(domain, type) {
    let AnswerList = [];
    let resolveType = dnsTypeFrom[type].resolveApi
    let res = await getDnsDoH(serverOption.DoHJSONServers[0], domain, type);
    if (res.Status == 0 && res.Answer && res.Answer.length) {
        res.Answer.forEach(async v => {
            if (v.type != resolveType) return;
            switch (v.type) {
                case 1:
                    v.type = 'A'
                    AnswerList.push(v)
                    break;
                case 2:
                    v.type = 'NS'
                    break;
                case 5:
                    v.type = 'CNAME'
                    break;
                case 6:
                    v.type = 'SOA'
                    break;
                case 16:
                    v.type = 'TXT'
                    break;
                case 28:
                    v.type = 'AAAA'
                    break;
            }
        })
    } else {
        return []
    }
    let result = AnswerList.map(item => {
        return createRecord(item.data, item.type)
    })
    setCache(domain, result, type, serverOption.cacheTime)
    return result;
}

function createRecord(value, type) {
    switch (type) {
        case 'A':
            return new named.ARecord(value);
        case 'AAAA':
            return new named.AAAARecord(value);
        case 'CNAME':
            return new named.CNAMERecord(value);
        case 'NS':
            return new named.NSRecord(value);
        case 'MX':
            return new named.MXRecord(value);
        case 'SOA':
            return new named.SOARecord(value);
        case 'SRV':
            return new named.SRVRecord(value, 5060);
        case 'TXT':
            return new named.TXTRecord(value);
    }
}

async function getDns(domain, type) {
    return await getHost(domain, type) || await getCache(domain, type) || await getDnsByServer(domain, type) || [];
}

server.listen(serverOption.port, '0.0.0.0', function () {
    console.log('DNS server started on port ' + serverOption.port);
});

server.on('query', async function (query) {
    let domain = query.name()
    let type = query.type();
    let res = await getDns(domain, type);
    console.log("query ", type, ' :', domain, "==>", res.map(v => v.target).join(', '));
    res.forEach(v => {
        query.addAnswer(domain, v, serverOption.ttl);
    });
    server.send(query);
});

server.on('error', function (e) {
    console.log('server error', e);
});