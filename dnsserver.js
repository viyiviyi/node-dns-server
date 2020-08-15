const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const https = require('https');
let hosts = {}
const cache = {}
let delTimeout = {}

async function getDns(domain, type) {
  ip = cache[domain]
  if (ip) {
    console.log('cache:' + domain + '  ==>  ' + ip)
    return ip
  }
  let res = await new Promise((res, rej) => {
    https.get('https://223.5.5.5/resolve?name=' + domain + '&type=' + type, function (data) {
      var str = "";
      data.on("data", function (chunk) {
        str += chunk;
      })
      data.on("end", function () {
        res(JSON.parse(str))
      })
      data.on("error", function (err) {
        rej(err)
      })
    })
  })
  // if (domain == 'down.verify.stat.xunlei.com') console.log(res)
  if (res.Status == 0 && res.Answer.length) {
    let ip
    res.Answer.forEach(v => {
      if (!ip && v.type == 1) {
        ip = v.data
      }
    })
    if (!ip) return await getDns(res.Answer[0].data)
    console.log('Resove:' + domain + '  ==>  ' + ip)
    return ip
  } else {
    // console.log('error')
  }
}
async function dnsResove(msg, domain, type = 1, rinfo) {
  let ip = await getDns(domain, type)
  if (ip) {
    cache[domain] = ip
    delTimeout[domain] = Date.now() + 1000 * 60 * 5
  }
  resolve(ip, msg, rinfo)
}

setInterval(f => {
  let time = Date.now();
  Object.keys(delTimeout).forEach(key => {
    if (delTimeout[key] >= time) delete cache[key]
  })
}, 1000 * 30)

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