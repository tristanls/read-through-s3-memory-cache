# read-through-s3-memory-cache

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

[![NPM version](https://badge.fury.io/js/read-through-s3-memory-cache.png)](http://npmjs.org/package/read-through-s3-memory-cache)

Read-through in-memory cache for S3 objects that are reasonable to cache in memory.

## Contributors

[@tristanls](https://github.com/tristanls)

## Contents

  * [Overview](#overview)
  * [Installation](#installation)
  * [Tests](#tests)
  * [Usage](#usage)
  * [Documentation](#documentation)
  * [Releases](#releases)

## Overview

This module offers a read-through in-memory cache for small objects that are stored in S3. It assumes it is running in an environment where [aws-sdk](https://github.com/aws/aws-sdk-js) has access to its standard credentials chain with `s3:GetObject` permission to the configured S3 Bucket.

## Installation

    npm install read-through-s3-memory-cache

## Tests

    npm test

## Usage

```javascript
const Cache = require("read-through-s3-memory-cache");
const cache = new Cache(
{
    bucket: "name-of-my-s3-bucket"
});
cache.get("myKey", (error, value) =>
{
    console.log(error, value);
});

const initialCache = new Map();
initialCache.set("myKey", Buffer.from("myValue"));
const cache2 = new Cache(
{
    bucket: "name-of-my-other-s3-bucket",
    initialCache
});
cache2.get("myKey", (error, value) =>
{
    console.log(error, value);
});
```

## Documentation

### Cache

**Public API**
  * [Cache.S3_NOT_FOUND_CODES](#caches3_not_found_codes)
  * [new Cache(config)](#new-cacheconfig)
  * [cache.get(key, callback)](#cachegetkey-callback)

#### Cache.S3_NOT_FOUND_CODES

  * `["AccessDenied", "NoSuchKey"]`

Default S3 error codes to treat as "not found" (`AccessDenied` can occur of the object does not exist but the caller has no `s3:ListBucket` permission).

#### new Cache(config)

  * `config`: _Object_ Cache configuration.
    * `bucket`: _String_ Name of S3 bucket to retrieve values from.
    * `initialCache`: _Map_ _(Default: undefined)_ Initial cached values to use.

Creates a new Cache.

#### Cache.get(key, callback)

  * `key`: _String_ S3 Key to retrieve from cache.
  * `callback`: _Function_ `function(error, value){}`
    * `error`: _Error_ Error, if any.
    * `value`: _Buffer_ S3 Object, if it exists, `undefined` otherwise.

Retrieves the cached `value` from memory. If not found in memory, attempts to retrieve the `value` from S3. If not found in S3, caches `undefined` locally, otherwise, caches the `value` locally.

## Releases

[Current releases](https://github.com/tristanls/read-through-s3-memory-cache/releases).

### Policy

We follow the semantic versioning policy ([semver.org](http://semver.org/)) with a caveat:

> Given a version number MAJOR.MINOR.PATCH, increment the:
>
>MAJOR version when you make incompatible API changes,<br/>
>MINOR version when you add functionality in a backwards-compatible manner, and<br/>
>PATCH version when you make backwards-compatible bug fixes.

**caveat**: Major version zero is a special case indicating development version that may make incompatible API changes without incrementing MAJOR version.
