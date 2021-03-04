
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const https = require('https');
const tls = require("tls");
const dnsPacket = require("dns-packet")

const defaultOption = {
    host: '223.5.5.5',
    servername: 'dns.alidns.com',
    port:853
}

server.on('message', async (msg, rinfo) => {
    let timeStart = Date.now();
    let host = parseHost(msg.slice(12));
    if (typeof host == 'string') host = host.toLowerCase()
    if (host.length == 0) result('127.0.0.1');
    let hostData = await getHost(host)
    if (hostData)return result(hostData)
    
    let cacheData = await getCache(host)
    if (hostData) return result(cacheData)

    getDoT(host, {}).then(res => {
        
    })
    getDoHJson(host, {}).then(res => {
       
    })
    function result(ip) {
        console.log("getDns:", host, "==>", ip, ' ', Date.now() - timeStart, 'ms');
        resolve(ip, msg, rinfo)
    }
    dnstls.query({
        name: host,
        host: '223.5.5.5',
        servername:'dns.alidns.com',
        type: 'A',
        klass:'CH',
        port:853,
    }).then(res => {
        console.log(res.answers)
        let ip = res.answers.length?res.answers[0].data:'0.0.0.0'
        console.log("hosts:", host, "==>", ip);
        resolve(ip, msg, rinfo);
    })
})

server.on('error', (err) => {
    console.log('server error:' + err.stack);
})
server.on('listening', () => {
    const addr = server.address();
    console.log(`run ${addr.address}:${addr.port}`);
})
server.bind(9053);

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
    let host = parseHost(msg.slice(12));
    console.log("getCache:", host, "==>", ip);
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
        }
    })
}

async function getDoHJson(domain,option) {
    return new Promise((res, rej) => {
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
}

async function getDoT(domain,option) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect(defaultOption);
        socket.on('secureConnect', () => socket.write(dnsQueryBuf));
        socket.on('data', (data) => {
            if (response.length === 0) {
                packetLength = data.readUInt16BE(0);
                if (packetLength < 12) {
                    reject('Below DNS minimum packet length (DNS Header is 12 bytes)');
                }
                response = Buffer.from(data);
                exports.checkDone({ response, packetLength, socket, resolve });
            }
            else {
                response = Buffer.concat([response, data]);
                exports.checkDone({ response, packetLength, socket, resolve });
            }
        });
    });
}

async function getHost(domain){

}
async function getCache(domain) {
    
}
async function getConfig() {
    
}