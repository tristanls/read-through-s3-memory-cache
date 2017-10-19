"use strict";

const clone = require("clone");

const Cache = require("./index.js");

const VALID_CONFIG = require("./test/config/valid.js");

const countdown = (done, count) =>
{
    let doneCount = 0;
    return () =>
    {
        doneCount++;
        if (doneCount == count)
        {
            done();
        }
    }
};


describe("if value present in cache", () =>
{
    let config;
    beforeEach(() =>
        {
            jest.resetModules();
            config = clone(VALID_CONFIG);
            config.initialCache = new Map();
            config.initialCache.set("myKey", Buffer.from("myValue"));
        }
    );
    it("calls callback with no error, and with value", done =>
        {
            const cache = new Cache(config);
            cache.get("myKey", (error, value) =>
                {
                    expect(error).toBeFalsy();
                    expect(value).toEqual(Buffer.from("myValue"));
                    done();
                }
            );
        }
    );
    it("does not call S3", done =>
        {
            jest.mock("aws-sdk");
            const AWS = require("aws-sdk");
            AWS.S3.mockImplementation(() => (
                {
                    getObject: _ => expect("invocation").toBe(false)
                }
            ));
            const Cache = require("./index.js");
            const cache = new Cache(config);
            cache.get("myKey", (error, value) =>
                {
                    expect(error).toBeFalsy();
                    expect(value).toEqual(Buffer.from("myValue"));
                    done();
                }
            );
        }
    );
});

describe("if value not present in cache", () =>
{
    beforeEach(() =>
        {
            jest.resetModules();
        }
    );
    it("calls AWS.S3.getObject, if error, calls callback with error", done =>
        {
            jest.mock("aws-sdk");
            const AWS = require("aws-sdk");
            AWS.S3.mockImplementation(() => (
                {
                    getObject: (params, callback) =>
                    {
                        expect(params).toEqual(
                            {
                                Bucket: VALID_CONFIG.bucket,
                                Key: "myKey"
                            }
                        );
                        return callback(new Error("boom"));
                    }
                }
            ));
            const Cache = require("./index.js");
            const cache = new Cache(VALID_CONFIG);
            cache.get("myKey", (error, value) =>
                {
                    expect(error).toBeTruthy();
                    expect(value).toBe(undefined);
                    done();
                }
            );
        }
    );
    Cache.S3_NOT_FOUND_CODES.map(notFoundCode =>
        {
            it(`calls AWS.S3.getObject, if ${notFoundCode}, calls callbakc with no error and no value`, done =>
                {
                    jest.mock("aws-sdk");
                    const AWS = require("aws-sdk");
                    AWS.S3.mockImplementation(() => (
                        {
                            getObject: (_, callback) => callback(
                                {
                                    code: notFoundCode
                                }
                            )
                        }
                    ));
                    const Cache = require("./index.js");
                    const cache = new Cache(VALID_CONFIG);
                    cache.get("myKey", (error, value) =>
                        {
                            expect(error).toBeFalsy();
                            expect(value).toBe(undefined);
                            done();
                        }
                    );
                }
            );
        }
    );
    it("calls AWS.S3.getObject, if object exists, calls callback with no error and value and caches the value", done =>
        {
            let s3GetObjectCalled = false;
            jest.mock("aws-sdk");
            const AWS = require("aws-sdk");
            AWS.S3.mockImplementation(() => (
                {
                    getObject: (_, callback) =>
                    {
                        if (!s3GetObjectCalled)
                        {
                            s3GetObjectCalled = true;
                            return callback(undefined,
                                {
                                    Body: Buffer.from("myValue")
                                }
                            );
                        }
                        expect("invocation").toBe(false);
                    }
                }
            ));
            const Cache = require("./index.js");
            const cache = new Cache(VALID_CONFIG);
            cache.get("myKey", (error, value) =>
                {
                    expect(error).toBeFalsy();
                    expect(value).toEqual(Buffer.from("myValue"));
                    cache.get("myKey", (error, value) =>
                        {
                            expect(error).toBeFalsy();
                            expect(value).toEqual(Buffer.from("myValue"));
                            done();
                        }
                    );
                }
            );
        }
    );
});
