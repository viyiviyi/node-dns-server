var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var dgram = require('dgram');
var server = dgram.createSocket('udp4');
var https = require('https');
var hosts = {};
var cache = {};
var delTimeout = {};
var isLog = true;
function getDns(domain, type) {
    if (type === void 0) { type = 1; }
    return __awaiter(this, void 0, void 0, function () {
        var ip, res, ip_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ip = cache[domain];
                    if (ip) {
                        console.log('cache:' + domain + '  ==>  ' + ip);
                        return [2 /*return*/, ip];
                    }
                    return [4 /*yield*/, new Promise(function (res, rej) {
                            https.get('https://223.5.5.5/resolve?name=' + domain + '&type=' + type, function (data) {
                                var str = "";
                                data.on("data", function (chunk) {
                                    str += chunk;
                                });
                                data.on("end", function () {
                                    res(JSON.parse(str));
                                });
                                data.on("error", function (err) {
                                    rej(err);
                                });
                            });
                        })];
                case 1:
                    res = _a.sent();
                    if (!(res.Status == 0 && res.Answer.length)) return [3 /*break*/, 4];
                    res.Answer.forEach(function (v) {
                        if (!ip_1 && v.type == 1) {
                            ip_1 = v.data;
                        }
                    });
                    if (!!ip_1) return [3 /*break*/, 3];
                    return [4 /*yield*/, getDns(res.Answer[0].data)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    console.log('Resove:' + domain + '  ==>  ' + ip_1);
                    return [2 /*return*/, ip_1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function dnsResove(msg, domain, type, rinfo) {
    if (type === void 0) { type = 1; }
    return __awaiter(this, void 0, void 0, function () {
        var ip;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDns(domain, type)];
                case 1:
                    ip = _a.sent();
                    if (ip) {
                        cache[domain] = ip;
                        delTimeout[domain] = Date.now() + 1000 * 60 * 5;
                    }
                    resolve(ip, msg, rinfo);
                    return [2 /*return*/];
            }
        });
    });
}
setInterval(function (f) {
    var time = Date.now();
    Object.keys(delTimeout).forEach(function (key) {
        if (delTimeout[key] >= time)
            delete cache[key];
    });
}, 1000 * 30);
function parseHost(msg) {
    var num = msg[0];
    var offset = 1;
    var host = "";
    while (num !== 0) {
        host += (msg.slice(offset, offset + num).toString());
        offset += num;
        num = msg[offset];
        offset += 1;
        if (num !== 0)
            host += ('.');
    }
    return host;
}
function resolve(ip, msg, rinfo) {
    var len = msg.length;
    var templet;
    if (ip)
        templet = [192, 12, 0, 1, 0, 1, 0, 0, 0, 218, 0, 4].concat(ip.split(".").map(function (i) { return Number(i); }));
    else
        templet = [192, 12, 0, 3, 0, 1, 0, 0, 0, 218, 0, 4];
    var response = new ArrayBuffer(len + 16);
    var bufView = new Uint8Array(response);
    for (var i = 0; i < msg.length; i++)
        bufView[i] = msg[i];
    for (var i = 0; i < templet.length; i++)
        bufView[msg.length + i] = templet[i];
    bufView[2] = 129;
    bufView[3] = 128;
    bufView[7] = 1;
    server.send(bufView, rinfo.port, rinfo.address, function (err) {
        if (err) {
            console.log(err);
            // server.close();
        }
    });
}
function getHost(host) {
    hosts = require('../dnsserver.json');
    var ip = hosts[host];
    if (ip)
        return ip;
    var ah = Object.keys(hosts);
    for (var i = 0, l = ah.length; i < l; i++) {
        if (host.indexOf('.' + ah[i]) != -1)
            return hosts[ah[i]];
    }
}
server.on('message', function (msg, rinfo) {
    var host = parseHost(msg.slice(12));
    if (typeof host == 'string')
        host = host.toLowerCase();
    var ip = getHost(host);
    if (ip) {
        console.log("hosts:", host, "==>", ip);
        resolve(ip, msg, rinfo);
    }
    else {
        dnsResove(msg, host, 1, rinfo);
    }
});
server.on('error', function (err) {
    console.log('server error:' + err.stack);
    // server.close();
});
server.on('listening', function () {
    var addr = server.address();
    console.log("run " + addr.address + ":" + addr.port);
});
server.bind(53);
if (!isLog)
    console.log = function () { };
