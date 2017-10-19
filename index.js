"use strict";

const AWS = require("aws-sdk");
const clone = require("clone");
const events = require("events");
const Joi = require("joi");
const LogTelemetryEvents = require("telemetry-events-log");
const markTime = require("mark-time");
const pkg = require("./package.json");
const QuantifyTelemetryEvents = require("telemetry-events-quantify");
const TelemetryEvents = require("telemetry-events");
const TraceTelemetryEvents = require("telemetry-events-trace");
const util = require("util");

const Cache = module.exports = function(config)
{
    if (!(this instanceof Cache))
    {
        return new Cache(config);
    }
    const self = this;

    self.name = pkg.name;
    self.version = pkg.version;

    const configValidationResult = Joi.validate(
        config, Cache.SCHEMA.config,
        {
            abortEarly: false,
            convert: false
        });
    if (configValidationResult.error)
    {
        throw configValidationResult.error;
    }

    Object.keys(config).map(property =>
    {
        self[`_${property}`] = config[property];
    });
    events.EventEmitter.call(self);

    self._cache = new Map();
    if (self._initialCache)
    {
        self._initialCache.forEach((value, key) => self._cache.set(key, value));
    }
    self._s3 = new AWS.S3();

    self._telemetry = new TelemetryEvents(
    {
        package: pkg,
        emitter: self
    });
    self._log = new LogTelemetryEvents(
        {
            telemetry: self._telemetry
        }
    ).log;
    self._metrics = new QuantifyTelemetryEvents(
    {
        telemetry: self._telemetry
    });
    self._tracing = new TraceTelemetryEvents(
        {
            telemetry: self._telemetry
        }
    );

    if (self._stdoutTelemetry)
    {
        self.on("telemetry", event =>
            {
                // clone handles circular dependencies
                console.log(JSON.stringify(clone(event)));
            }
        );
    }
};

util.inherits(Cache, events.EventEmitter);

Cache.SCHEMA =
{
    config: Joi.object().keys(
        {
            bucket: Joi.string().required(),
            initialCache: Joi.object().type(Map),
            stdoutTelemetry: Joi.bool()
        }
    )
};
Cache.S3_NOT_FOUND_CODES =
[
    "AccessDenied", "NoSuchKey"
];


Cache.prototype.get = function(key, context, callback)
{
    const self = this;
    if (context && context instanceof Function)
    {
        callback = context;
        context = {};
    }
    if (self._cache.has(key))
    {
        return callback(undefined, self._cache.get(key));
    }
    const _targetMetadata = {
        method: "get",
        target: {
            module: "aws-sdk",
            version: AWS.VERSION,
            export: "S3",
            method: "getObject"
        }
    };
    const params = {
        Bucket: self._bucket,
        Key: key
    };
    self._log("info", "getting object from S3", _targetMetadata,
    {
        target: {
            args: [params]
        }
    });
    let traceSpan;
    if (context.parentSpan)
    {
        traceSpan = context.parentSpan.childSpan("AWS.S3.getObject");
    }
    const startTime = markTime();
    self._s3.getObject(params, (error, data) =>
    {
        const elapsedTime = markTime() - startTime;
        self._metrics.gauge("latency",
        {
            unit: "ms",
            value: elapsedTime,
            metadata: clone(_targetMetadata)
        });
        if (error)
        {
            const notFound = Cache.S3_NOT_FOUND_CODES.indexOf(error.code) >= 0;
            if (notFound)
            {
                self._cache.set(key, undefined);
                return callback();
            }
            self._log("error", "getting object from S3 failed", _targetMetadata,
            {
                target: {
                    args: [params]
                },
                error,
                stack: error.stack
            });
            if (traceSpan)
            {
                traceSpan.tag("error", true);
                traceSpan.finish();
            }
            return callback(error);
        }
        if (traceSpan)
        {
            traceSpan.finish();
        }
        self._cache.set(key, data.Body);
        return callback(undefined, data.Body);
    });
};
