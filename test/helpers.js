/*
 * helpers.js: Test helpers for winston
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    util = require('util'),
    loggly = require('loggly'),
    vows = require('vows'),
    winston = require('../lib/winston');    
    
var helpers = exports;

helpers.loadConfig = function (dir) {
  try {
    if (helpers.config) return helpers.config;
    var configFile = path.join(dir || __dirname, 'fixtures', 'test-config.json'),
        stats = fs.statSync(configFile),
        config = JSON.parse(fs.readFileSync(configFile).toString());
    
    helpers.config = config;
    return config;
  }
  catch (ex) {
    util.puts('test/fixtures/test-config.json must be created with valid data before running tests');
    process.exit(0);
  }
};

helpers.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      size++;
    }
  }
  
  return size;
};

helpers.tryUnlink = function (file) {
  try { fs.unlinkSync(file) }
  catch (ex) { }
}


helpers.assertProcessInfo = function (info) {
  assert.isNumber(info.pid);
  assert.isNumber(info.uid);
  assert.isNumber(info.gid);
  assert.isString(info.cwd);
  assert.isString(info.execPath);
  assert.isString(info.version);
  assert.isArray(info.argv);
  assert.isObject(info.memoryUsage);
};

helpers.assertOsInfo = function (info) {
  assert.isArray(info.loadavg);
  assert.isNumber(info.uptime);
};

helpers.assertTrace = function (trace) {
  trace.forEach(function (site) {
    assert.isTrue(!site.column || typeof site.column === 'number');
    assert.isTrue(!site.line || typeof site.line === 'number');
    assert.isTrue(!site.file || typeof site.file === 'string');
    assert.isTrue(!site.method || typeof site.method === 'string');
    assert.isTrue(!site.function || typeof site.function === 'string');
    assert.isTrue(typeof site.native === 'boolean');
  });
};

helpers.assertLogger = function (logger, level) {
  assert.instanceOf(logger, winston.Logger);
  assert.isFunction(logger.log);
  assert.isFunction(logger.add);
  assert.isFunction(logger.remove);
  assert.equal(logger.level, level || "info");
  Object.keys(logger.levels).forEach(function (method) {
    assert.isFunction(logger[method]);
  });
};

helpers.assertConsole = function (transport) {
  assert.instanceOf(transport, winston.transports.Console);
  assert.isFunction(transport.log);
};

helpers.assertFile = function (transport) {
  assert.instanceOf(transport, winston.transports.File);
  assert.isFunction(transport.log);
}

helpers.assertLoggly = function (transport) {
  assert.instanceOf(transport, winston.transports.Loggly);
  assert.isFunction(transport.log);  
};

helpers.assertWebhook = function (transport) {
  assert.instanceOf(transport, winston.transports.Webhook);
  assert.isFunction(transport.log);
};

helpers.assertHandleExceptions = function (options) {
  return {
    topic: function () {
      var that = this,
          child = spawn('node', [options.script]);

      helpers.tryUnlink(options.logfile);
      child.on('exit', function () {
        fs.readFile(options.logfile, that.callback);
      });
    },
    "should save the error information to the specified file": function (err, data) {
      assert.isTrue(!err);
      data = JSON.parse(data);

      assert.isObject(data);
      helpers.assertProcessInfo(data.process);
      helpers.assertOsInfo(data.os);
      helpers.assertTrace(data.trace);
    }
  }
}

helpers.testNpmLevels = function (transport, assertMsg, assertFn) {
  return helpers.testLevels(winston.config.npm.levels, transport, assertMsg, assertFn);
};

helpers.testSyslogLevels = function (transport, assertMsg, assertFn) {
  return helpers.testLevels(winston.config.syslog.levels, transport, assertMsg, assertFn);
};

helpers.testLevels = function (levels, transport, assertMsg, assertFn) {
  var tests = {};
  
  Object.keys(levels).forEach(function (level) {
    var test = {
      topic: function () {
        transport.log(level, 'test message', {}, this.callback.bind(this, null));
      }
    };
   
    test[assertMsg] = assertFn;
    tests['with the ' + level + ' level'] = test;
  });
  
  var test = {
    topic: function () {
      transport.log('info', 'test message', { metadata: true }, this.callback.bind(this, null));
    }
  };
  
  test[assertMsg] = assertFn;
  tests['when passed metadata'] = test;
  return tests;
};