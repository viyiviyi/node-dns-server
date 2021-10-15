const https = require('https');
let hosts = {}
const cache = {}
var named = require('lts-dns-server-lib');
var server = named.createServer();
var ttl = 0;

setTimeout(() => {
    let keys = Object.keys(cache)
    for (let i = 0, l = keys.length; i < l; i++) {
        cache[keys[i]].forEach((v, idx) => {
            if (v.ttl <= Date.now()) cache[keys[i]].splice(idx, 1)
        })
    }
}, 1000 * 60 * 10);

async function getDnsByServer(domain) {
    let AnswerList = [];
    let res = await new Promise((res, rej) => {
        https.get('https://223.5.5.5/resolve?name=' + domain + '&type=1', function (data) {
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
    if (res.Status == 0 && res.Answer && res.Answer.length) {
        res.Answer.forEach(async v => {
            if (v.type == 1) {
                ip = v.data
                v.name = domain
                v.type = 'A'
                AnswerList.push(v)
            }
            if (v.type == 28) {
                ip = v.data
                v.name = domain
                v.type = 'AAAA'
                AnswerList.push(v)
            }
        })
    } else {
        // console.log('error')
    }
    setCache(domain, AnswerList)
    return AnswerList.map(item => {
        return createRecord(item.data, item.type)
    })
}
async function getCache(query) {
    let domain = query.name();
    let domainCache = cache[domain];
    if (!domainCache || domainCache.length == 0) return undefined;
    let cacheItem = domainCache[0]
    if (!cacheItem) return undefined;
    if (cacheItem.ttl <= Date.now()) getDnsByServer(domain);
    return domainCache.map(val => {
        return createRecord(val.value, val.type)
    });
}
function setCache(domain, answerList) {
    let domainCache = cache[domain];
    if (!domainCache) domainCache = []
    let time = Date.now();
    answerList.forEach((answerItem, idx) => {
        if (!answerItem || !answerItem.data) return;
        let cacheIndex = domainCache.findIndex(f => f.value == answerItem.data);
        if (cacheIndex == -1) return domainCache.push({ value: answerItem.data, ttl: answerItem.TTL * 1000 + time, sortin: 1, type: answerItem.type })
        let _cItem = domainCache[cacheIndex]
        if (_cItem) {
            if (!idx) _cItem.sortin ? _cItem.sortin += 1 : _cItem.sortin = 1
            else _cItem.sortin ? _cItem.sortin -= 1 : _cItem.sortin = 1
            if (_cItem.sortin > 10) _cItem.sortin = 10
            if (_cItem.sortin < 1) _cItem.sortin = 1
            _cItem.ttl = answerItem.TTL * 1000 + time
        }
        domainCache[cacheIndex] = _cItem
    })
    cache[domain] = domainCache.sort((n, i) => (n.sortin == i.sortin ? i.ttl - n.ttl : i.sortin - n.sortin))
}

function getHost(host) {
    hosts = require('./dnsserver.json')
    let ip = hosts[host]
    let reg = /^\*\./;
    if (ip) return ip
    let ah = Object.keys(hosts);

    for (let i = 0, l = ah.length; i < l; i++) {
        if (reg.test(ah) && host.indexOf(ah[i].substring(1)) != -1) return hosts[ah[i]];
    }
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

function sendResult(query, value, rtype) {
    var domain = query.name();
    let type = rtype || query.type();
    query.addAnswer(domain, createRecord(value, type), ttl);
}

server.listen(53, '0.0.0.0', function () {
    console.log('DNS server started on port 53');
});

server.on('query', async function (query) {
    let domain = query.name()
    let host = getHost(domain);
    if (host) {
        console.log("query ", query.type(), ' host :', domain, "==>", host);
        sendResult(query, val, 'A');
        server.send(query);
        return;
    }
    let res = await getCache(query)
    console.log("query ", query.type(), ' cache :', domain, "==>", res);
    res && res.length && res.forEach(record => {
        query.addAnswer(domain, record, ttl);
    });
    if (res && res.length) {
        server.send(query);
        return;
    }
    await getDnsByServer(query.name()).then(res => {
        console.log("query ", query.type(), ' aldns :', domain, "==>", res);
        res.forEach(record => {
            query.addAnswer(domain, record, ttl);
        });
        if (res.length) {
            server.send(query);
            return;
        }
    })
});

server.on('error', function (e) {
    console.log('server error', e);
});