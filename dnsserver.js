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
                AnswerList.push(v)
            }
        })
    } else {
        // console.log('error')
    }
    setCache(domain, AnswerList)
    return AnswerList
}
async function getCache(domain) {
    let domainCache = cache[domain];
    if (!domainCache || domainCache.length == 0) return undefined;
    let cacheItem = domainCache[0]
    if (!cacheItem) return undefined;
    if (cacheItem.ttl <= Date.now()) getDnsByServer(domain);
    return cacheItem.value;
}
function setCache(domain, answerList) {
    let domainCache = cache[domain];
    if (!domainCache) domainCache = []
    let time = Date.now();
    answerList.forEach((answerItem, idx) => {
        if (!answerItem || !answerItem.data) return;
        let cacheIndex = domainCache.findIndex(f => f.value == answerItem.data);
        if (cacheIndex == -1) return domainCache.push({ value: answerItem.data, ttl: answerItem.TTL * 1000 + time, sortin: 1 })
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

async function getDns(domain) {
    let ip = getHost(domain) || await getCache(domain);
    if (ip) {
        return ip
    }
    await getDnsByServer(domain)
    return await getCache(domain) || '0.0.0.0';
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

function sendResult(query, type, value) {
    var domain = query.name()
    switch (type) {
        case 'A':
            var record = new named.ARecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'AAAA':
            var record = new named.AAAARecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'CNAME':
            var record = new named.CNAMERecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'NS':
            var record = new named.NSRecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'MX':
            var record = new named.MXRecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'SOA':
            var record = new named.SOARecord(value);
            query.addAnswer(domain, record, ttl);
            break;
        case 'SRV':
            var record = new named.SRVRecord(value, 5060);
            query.addAnswer(domain, record, ttl);
            break;
        case 'TXT':
            var record = new named.TXTRecord(value);
            query.addAnswer(domain, record, ttl);
            break;
    }
}

server.listen(9053, '0.0.0.0', function () {
    console.log('DNS server started on port 53');
});

server.on('query', function (query) {
    getDns(query.name()).then(val => {
        console.log("query ", query.type(), ' :', query.name(), "==>", val);
        sendResult(query, 'A', val);
        server.send(query);
    })
});

server.on('error', function (e) {
    console.log('server error', e);
});