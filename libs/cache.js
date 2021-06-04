'use strict';
const redis = require('redis');
const logger = new Logger("cache");
const config = require("../config.json");
const common_func = ['save', 'reload', 'toPlain', 'loadFields'];
Promise.promisifyAll(redis);

const redisObj = {
    client: null,
    connect: function () {
        this.client = redis.createClient(config.redis);
        this.client.on('error', function (err) {
            logger.error('redisCache Error ' + err);
        });
        this.client.on('ready', function () {
            logger.info('redisCache connection succeed.');
        });
    },
    init: function () {
        this.connect(); // 创建连接
        const client = this.client;
        return {
            set: async function(key, value, funcList) {
                if (value !== undefined) {
                    const modelName = key.replace(/\#\w+/, '');
                    if(!ModelFunc[modelName]) ModelFunc[modelName] = {};
                    key = `${config.cache_prefix}#${key}`;
    
                    //重写class中的non-enumerable(不可枚举)属性 obj中的function
                    if(funcList && funcList.length > 0){
                        for(let fname of funcList) //load functions
                            if(fname !== "constructor"){
                                if(!ModelFunc[modelName][fname])ModelFunc[modelName][fname] = value[fname];
                                value[fname] = value[fname];
                            }
    
                        for(let fname of common_func) {
                            if(!ModelFunc[modelName][fname])ModelFunc[modelName][fname] = value[fname];
                            value[fname] = value[fname];
                        }
                    }
    
                    //序列化带有function的Object
                    let cache_value =JSON.stringify(value, function(key, val) {
                        if (typeof val === 'function') return '[function]';
                        return val;
                    });
                    client.setAsync(key, cache_value);
                }else{
                    logger.warn("value of %s is undefined...", key);
                }
            },
            get: async function(key){
                const modelName = key.replace(/\#\w+/, '');
                key = `${config.cache_prefix}#${key}`;
                try {
                    let obj = await client.getAsync(key);
                    if(obj){
                        let reloadFunc = false;
                        obj = JSON.parse(obj,function(k,v){ //反序列化有function的Object
                            if(v === '[function]'){
                                if(!ModelFunc[modelName] || !ModelFunc[modelName][k]){
                                    reloadFunc = true;
                                    return null;
                                }
                                return ModelFunc[modelName][k];
                            }
                            return v;
                        });

                        if(reloadFunc){
                            // logger.warn("reload %s functions.", modelName);
                            return null;
                        }
                    }
                   
                    return obj;
                }catch(err){
                    logger.warn('redis get failed ', key, err);
                }
            },
            remove: async function(key){
                key = `${config.cache_prefix}#${key}`;
                try {
                    let ret = await client.del(key);
                    return ret;
                }catch(err){
                    logger.warn('redis remove failed ', key, err);
                }
            }
        }
    },
};
// 返回的是一个redis.client的实例
module.exports = redisObj.init();