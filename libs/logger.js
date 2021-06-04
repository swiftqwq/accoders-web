"use strict";
const path = require("path");
const util = require("util");
const fs = require("fs");
const moment = require("moment");
const colors = require("colors");
const callsite = require("callsite");
const cluster = require("cluster");
const morgan = require("morgan");
colors.setTheme({
    CRI: 'red',
    WRN: 'yellow',
    INF: 'reset',
    DBG: 'blue',
    TRC: 'blue',
    PRE: 'gray',
    JSO: 'reset'
});
let Console = console['Console'];
let conf = {};
conf.default = {
    logdir: path.join(__dirname, "../log"),
    prefix: 'logger_',
    console: true,
    file: null,
    ymd: null,
    logger: null
};
function init_mod_conf(opt, mod) {
    let c = get_log_conf(mod);
    if (opt.path)
        c.logdir = opt.path;
    if (opt.prefix)
        c.prefix = opt.prefix;
    if (opt.console != undefined)
        c.console = opt.console;
    if (!fs.existsSync(c.logdir))
        fs.mkdirSync(c.logdir);
    c.ymd = moment().format("YYMMDD");
    c.file = fs.createWriteStream(c.logdir + '/' + c.prefix + c.ymd + '.log');
    c.logger = new Console(c.file);
}
function get_log_conf(mod) {
    let c = conf[mod];
    if (c == undefined)
        c = conf.default;
    return c;
}
let logformat = '[%s][%s][%s](%s:%d): %s';
let consoleformat = colors['PRE']('[%s][%s](%s:%d): ') + '%s';
function writelog(level, mod, now, trace, logstr, stack) {
    if(mod === 'sequelize')logstr = logstr.replace(/\{\splain\:\s((true)|(false))[\w\W]*/, '').replace(/Executing\s\(default\)\:\s/, '');

    let c = get_log_conf(mod);
    now = moment(now);
    let ymd = now.format("YYMMDD");
    if (ymd != c.ymd) {
        c.ymd = ymd;
        if (c.file)
            c.file.end();
        c.file = fs.createWriteStream(c.logdir + '/' + c.prefix + c.ymd + '.log', {flags: "a"});
        // c.file = fs.createWriteStream(c.logdir + '/' + c.prefix + c.ymd + '.log');
        c.logger = new Console(c.file);
    }
    let logpoint = stack[0];
    let filename = logpoint.filename;
    let basename = path.basename(filename);
    if (basename == 'index.js') {
        basename = path.basename(path.dirname(filename)) + '/' + basename;
    }
    let linenumber = logpoint.linenumber;
    filename = path.relative(__dirname, filename).replace(/\.\.\//, '');
    let color = colors[level];
    let outstr = (mod === 'sequelize') ? logstr : util.format(logformat, now.format('HH:mm:ss.SSSS'), level, mod, filename, linenumber, logstr);
    let consolestr = outstr;
    if (c.console && color) {
        consolestr = util.format(consoleformat, level, mod, basename, linenumber, color(logstr));
        if(mod === 'sequelize') consolestr = util.format(colors['PRE']('[%s][%s]: ') + '%s', level, 'SQL', color(logstr));
    }

    if(mod !== 'sequelize' || !/SHOW\sINDEX\sFROM/.test(logstr)){
        if (c.console)
        console.log(consolestr);
        c.logger.log(outstr);
        if (trace) {
            stack.forEach(function (point) {
                let line = util.format('    at %s', point.line);
                if (c.console)
                    console.log(line);
                c.logger.log(line);
            });
        }
    }
}
function sendlog(level, mod, now, trace, logstr, stack) {
    process.send({ cmd: 'log', level: level, mod: mod, now: now, trace: trace, logstr: logstr, stack: stack });
}
let outputlog = writelog;
function loggerInit(options) {
    if (cluster.isWorker) {
        outputlog = sendlog;
        return;
    }
    if (!options) {
        options = {};
    }
    init_mod_conf(options, 'default');
    if (typeof (options.mods) == 'object') {
        for (let mod in options.mods) {
            let opt = options.mods[mod];
            conf[mod] = {
                logdir: conf.default.logdir,
                prefix: conf.default.prefix,
                console: conf.default.console,
                file: null,
                ymd: null,
                logger: null
            };
            init_mod_conf(opt, mod);
        }
    }
    cluster.on('fork', function (worker) {
        worker.on('message', function (msg) {
            if (msg.cmd == 'log') {
                writelog(msg.level, msg.mod, msg.now, msg.trace, msg.logstr, msg.stack);
            }
        });
    });
}
function loggerFinish() {
    for (let mod in conf) {
        let c = conf[mod];
        c.file.end();
        c.file = null;
        c.ymd = null;
        c.logger = null;
    }
}
function log(level, mod, logstr, trace) {
    if (logstr.length == 0) {
        return;
    }
    let now = new Date();
    let callsites = callsite();
    callsites = callsites.slice(2, trace ? -1 : 3);
    let stack = callsites.map(function (point) {
        return {
            filename: point.getFileName(),
            linenumber: point.getLineNumber(),
            line: point.toString()
        };
    });
    outputlog(level, mod, now, trace, logstr, stack);
}
function loggerHttplog(mod, format) {
    function compile(fmt) {
        fmt = fmt.replace(/"/g, '\\"');
        let js = '  return "' + fmt.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g, function (_, name, arg) {
            return '"\n    + (tokens["' + name + '"](req, res, "' + arg + '") || "-") + "';
        }) + '";';
        return new Function('tokens, req, res', js);
    }
    let fmt = morgan[format] || format || morgan['default'];
    if ('function' != typeof fmt)
        fmt = compile(fmt);
    return function (req, res, next) {
        let sock = req.socket;
        req['_startTime'] = new Date;
        req['_remoteAddress'] = req.ip
            || req['_remoteAddress']
            || (req.connection && req.connection.remoteAddress)
            || undefined;
        function logRequest() {
            res.removeListener('finish', logRequest);
            res.removeListener('close', logRequest);
            let logstr = fmt(morgan, req, res);
            if (null == logstr)
                return;
            log('INF', mod, logstr);
        }
        res.on('finish', logRequest);
        res.on('close', logRequest);
        next();
    };
}
/**
 * 记录日志类
 *
 * ```
 *  let Logger  = require("common/logger");
 *  let logger = new Logger('mod');
 *  logger.info("test");
 *  logger.error("test");
 *  logger.warn("test");
 * ```
 *
 * @param mod
 */
class Logger {
    constructor(mod) {
        this.cri = this.error;
        this.wrn = this.warn;
        this.inf = this.info;
        this.log = this.info;
        this.dbg = this.debug;
        this.trc = this.trace;
        this.jso = this.json;
        if (this == undefined) {
            return new Logger(mod);
        }
        if (mod == undefined)
            mod = '';
        this.mod = mod;
    }
    error(...args) {
        log('CRI', this.mod, util.format.apply(util, args));
    }
    ;
    warn(...args) {
        log('WRN', this.mod, util.format.apply(util, args));
    }
    ;
    info(...args) {
        log('INF', this.mod, util.format.apply(util, args));
    }
    ;
    debug(...args) {
        log('DBG', this.mod, util.format.apply(util, args));
    }
    ;
    trace(...args) {
        log('TRC', this.mod, util.format.apply(util, args), true);
    }
    ;
    json(...args) {
        args = args.map((a) => {
            if(a && a.record && a.record.toJSON && typeof a.record.toJSON == 'function')
                return a.record.toJSON();
            else return a;
        });
        log('JSO', this.mod, util.format.apply(util, args));
    }
    ;
}
Logger.init = loggerInit;
Logger.finish = loggerFinish;
Logger.httplog = loggerHttplog;
module.exports = Logger;
//# sourceMappingURL=logger.js.map
