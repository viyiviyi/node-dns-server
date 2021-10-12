const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const https = require('https');
let hosts = {}
const cache = {}

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
    let ip = await getCache(domain);
    if (ip) {
        return ip
    }
    await getDnsByServer(domain)
    return await getCache(domain) || '0.0.0.0';
}
async function dnsResove(msg, domain, type = 1, rinfo) {
    let timeStart = Date.now();
    let ip = await getDns(domain, type)
    console.log("getDns:", domain, "==>", ip, ' ', Date.now() - timeStart, 'ms');
    resolve(ip, msg, rinfo)
}

function parseHost(msg) { //转换域名
    let num = msg[0];
    let offset = 1;
    let host = "";
    while (num !== 0) {
        host += (msg.slice(offset, offset + num).toString());
        offset += num;
        num = msg[offset];
        offset += 1;
        if (num !== 0) host += ('.');
    }
    return host;
}

function resolve(ip, msg, rinfo) { //响应
    let len = msg.length;
    let templet
    if (ip)
        templet = [192, 12, 0, 1, 0, 1, 0, 0, 0, 218, 0, 4].concat(ip.split(".").map(i => Number(i)));
    else
        templet = [192, 12, 0, 3, 0, 1, 0, 0, 0, 218, 0, 4];
    const response = new ArrayBuffer(len + 16);
    var bufView = new Uint8Array(response);
    for (let i = 0; i < msg.length; i++) bufView[i] = msg[i];
    for (let i = 0; i < templet.length; i++) bufView[msg.length + i] = templet[i];
    bufView[2] = 129;
    bufView[3] = 128;
    bufView[7] = 1;
    server.send(bufView, rinfo.port, rinfo.address, (err) => {
        if (err) {
            console.log(err);
            // server.close();
        }
    })
}

function getHost(host) {
    hosts = require('./dnsserver.json')
    let ip = hosts[host]
    if (ip) return ip
    let ah = Object.keys(hosts);
    for (let i = 0, l = ah.length; i < l; i++) {
        if (host.indexOf('.' + ah[i]) != -1) return hosts[ah[i]];
    }
}

server.on('message', (msg, rinfo) => {
    let host = parseHost(msg.slice(12));
    if (typeof host == 'string') host = host.toLowerCase()
    if (host.length == 0) resolve('127.0.0.1', msg, rinfo);
    let ip = getHost(host)
    if (ip) {
        console.log("hosts:", host, "==>", ip);
        resolve(ip, msg, rinfo);
    } else {
        dnsResove(msg, host, 1, rinfo)
    }
})

server.on('error', (err) => {
    console.log('server error:' + err.stack);
    // server.close();
})
server.on('listening', () => {
    const addr = server.address();
    console.log(`run ${addr.address}:${addr.port}`);
})
server.bind(53);