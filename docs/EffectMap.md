# Effect Map

Hewg ships a curated map from standard-library and common-package symbols
to the effects they produce. The analyzer consults this map when it walks a
call graph and encounters an unannotated callee from the outside world. Users
extend the map via `hewg.config.json` (see Design.md §6); user entries
**override** — not append to — the built-in entry for the same key.

Every entry in this document has a test in `hewg-ts/tests/effect-map.test.ts`.
Queries for symbols not in the map return `undefined`; entries with an empty
effects list mean _known-pure_ — the analyzer treats them as effect-free
without warning.

## Key naming convention

| Origin | Key form | Example |
|---|---|---|
| Global, no import | `<name>` or `<Object>.<member>` | `fetch`, `Math.random`, `console.log` |
| Node built-in module | `node:<module>.<member>` | `node:fs.readFile` |
| Node built-in, class method | `node:<module>.<Class>.<method>` | `node:http.Server.listen` |
| npm package, top-level | `<pkg>.<member>` or bare `<pkg>` | `axios.get`, `node-fetch` |
| npm package, class method | `<pkg>.<Class>.<method>` | `pg.Client.query` |

## Effect vocabulary

Entries reference only the built-in effect names declared in
`hewg-ts/src/annotations/effect-vocab.ts`:
`net.http`, `net.https`, `net.tcp`, `net.udp`, `fs.read`, `fs.write`,
`fs.exec`, `proc.spawn`, `proc.env`, `proc.exit`, `time.read`, `time.sleep`,
`rand`, `log`.

## Web standard / globals

| Symbol | Effects | Rationale |
|---|---|---|
| `console.debug` | `log` | writes to stdout |
| `console.dir` | `log` | writes to stdout |
| `console.error` | `log` | writes to stderr |
| `console.info` | `log` | writes to stdout |
| `console.log` | `log` | writes to stdout |
| `console.table` | `log` | writes to stdout |
| `console.trace` | `log` | writes stack to stderr |
| `console.warn` | `log` | writes to stderr |
| `crypto.getRandomValues` | `rand` | Web Crypto CSPRNG |
| `crypto.randomUUID` | `rand` | Web Crypto CSPRNG-backed UUID |
| `Date.now` | `time.read` | reads wall-clock time |
| `fetch` | `net.https` | v0 assumes https regardless of URL scheme |
| `localStorage.clear` | `fs.write` | browser persistent storage write |
| `localStorage.getItem` | `fs.read` | browser persistent storage read |
| `localStorage.removeItem` | `fs.write` | browser persistent storage write |
| `localStorage.setItem` | `fs.write` | browser persistent storage write |
| `Math.random` | `rand` | non-cryptographic randomness |
| `performance.now` | `time.read` | monotonic clock read |
| `sessionStorage.clear` | `fs.write` | browser session storage write |
| `sessionStorage.getItem` | `fs.read` | browser session storage read |
| `sessionStorage.removeItem` | `fs.write` | browser session storage write |
| `sessionStorage.setItem` | `fs.write` | browser session storage write |
| `WebSocket` | `net.https` | opens network socket on construct |
| `XMLHttpRequest` | `net.https` | browser HTTP client; treated as https |

## Node built-ins

### `node:fs` and `node:fs/promises`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:fs.access` | `fs.read` |  |
| `node:fs.accessSync` | `fs.read` |  |
| `node:fs.appendFile` | `fs.write` |  |
| `node:fs.appendFileSync` | `fs.write` |  |
| `node:fs.chmod` | `fs.write` |  |
| `node:fs.chmodSync` | `fs.write` |  |
| `node:fs.chown` | `fs.write` |  |
| `node:fs.chownSync` | `fs.write` |  |
| `node:fs.copyFile` | `fs.read`, `fs.write` |  |
| `node:fs.copyFileSync` | `fs.read`, `fs.write` |  |
| `node:fs.createReadStream` | `fs.read` |  |
| `node:fs.createWriteStream` | `fs.write` |  |
| `node:fs.exists` | `fs.read` | deprecated but widely used |
| `node:fs.existsSync` | `fs.read` |  |
| `node:fs.lstat` | `fs.read` |  |
| `node:fs.lstatSync` | `fs.read` |  |
| `node:fs.mkdir` | `fs.write` |  |
| `node:fs.mkdirSync` | `fs.write` |  |
| `node:fs.open` | `fs.read` | conservative: caller may then read or write |
| `node:fs.openSync` | `fs.read` |  |
| `node:fs.readdir` | `fs.read` |  |
| `node:fs.readdirSync` | `fs.read` |  |
| `node:fs.readFile` | `fs.read` |  |
| `node:fs.readFileSync` | `fs.read` |  |
| `node:fs.realpath` | `fs.read` |  |
| `node:fs.realpathSync` | `fs.read` |  |
| `node:fs.rename` | `fs.write` |  |
| `node:fs.renameSync` | `fs.write` |  |
| `node:fs.rm` | `fs.write` |  |
| `node:fs.rmdir` | `fs.write` |  |
| `node:fs.rmdirSync` | `fs.write` |  |
| `node:fs.rmSync` | `fs.write` |  |
| `node:fs.stat` | `fs.read` |  |
| `node:fs.statSync` | `fs.read` |  |
| `node:fs.symlink` | `fs.write` |  |
| `node:fs.symlinkSync` | `fs.write` |  |
| `node:fs.unlink` | `fs.write` |  |
| `node:fs.unlinkSync` | `fs.write` |  |
| `node:fs.watch` | `fs.read` | opens filesystem watcher |
| `node:fs.writeFile` | `fs.write` |  |
| `node:fs.writeFileSync` | `fs.write` |  |
| `node:fs/promises.access` | `fs.read` |  |
| `node:fs/promises.appendFile` | `fs.write` |  |
| `node:fs/promises.chmod` | `fs.write` |  |
| `node:fs/promises.chown` | `fs.write` |  |
| `node:fs/promises.copyFile` | `fs.read`, `fs.write` |  |
| `node:fs/promises.lstat` | `fs.read` |  |
| `node:fs/promises.mkdir` | `fs.write` |  |
| `node:fs/promises.open` | `fs.read` | conservative: caller may then read or write |
| `node:fs/promises.readdir` | `fs.read` |  |
| `node:fs/promises.readFile` | `fs.read` |  |
| `node:fs/promises.realpath` | `fs.read` |  |
| `node:fs/promises.rename` | `fs.write` |  |
| `node:fs/promises.rm` | `fs.write` |  |
| `node:fs/promises.rmdir` | `fs.write` |  |
| `node:fs/promises.stat` | `fs.read` |  |
| `node:fs/promises.symlink` | `fs.write` |  |
| `node:fs/promises.unlink` | `fs.write` |  |
| `node:fs/promises.writeFile` | `fs.write` |  |

### `node:http` and `node:https`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:http.createServer` | `net.http` | binds a listening socket on .listen() |
| `node:http.get` | `net.http` |  |
| `node:http.request` | `net.http` |  |
| `node:http.Server.listen` | `net.http` |  |
| `node:https.createServer` | `net.https` |  |
| `node:https.get` | `net.https` |  |
| `node:https.request` | `net.https` |  |
| `node:https.Server.listen` | `net.https` |  |

### `node:child_process`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:child_process.exec` | `proc.spawn` |  |
| `node:child_process.execFile` | `proc.spawn` |  |
| `node:child_process.execFileSync` | `proc.spawn` |  |
| `node:child_process.execSync` | `proc.spawn` |  |
| `node:child_process.fork` | `proc.spawn` |  |
| `node:child_process.spawn` | `proc.spawn` |  |
| `node:child_process.spawnSync` | `proc.spawn` |  |

### `node:process`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:process.chdir` | `fs.write` | mutates process cwd |
| `node:process.cwd` | `fs.read` | reads current working directory |
| `node:process.env` | `proc.env` | property access or enumeration |
| `node:process.exit` | `proc.exit` |  |
| `node:process.kill` | `proc.spawn` | signals another process |
| `process.cwd` | `fs.read` | bare-global alias |
| `process.env` | `proc.env` | bare-global alias |
| `process.exit` | `proc.exit` | bare-global alias |

### `node:os`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:os.arch` | `proc.env` |  |
| `node:os.cpus` | `proc.env` |  |
| `node:os.homedir` | `proc.env` |  |
| `node:os.hostname` | `proc.env` |  |
| `node:os.loadavg` | `proc.env` |  |
| `node:os.networkInterfaces` | `proc.env` |  |
| `node:os.platform` | `proc.env` |  |
| `node:os.release` | `proc.env` |  |
| `node:os.tmpdir` | `proc.env` |  |
| `node:os.type` | `proc.env` |  |
| `node:os.uptime` | `time.read` | host uptime is a clock read |
| `node:os.userInfo` | `proc.env` |  |

### `node:crypto`

| Symbol | Effects | Rationale |
|---|---|---|
| `node:crypto.generateKeyPair` | `rand` |  |
| `node:crypto.generateKeyPairSync` | `rand` |  |
| `node:crypto.randomBytes` | `rand` |  |
| `node:crypto.randomFill` | `rand` |  |
| `node:crypto.randomFillSync` | `rand` |  |
| `node:crypto.randomInt` | `rand` |  |
| `node:crypto.randomUUID` | `rand` |  |
| `node:crypto.webcrypto.getRandomValues` | `rand` |  |

## npm packages

Coverage is limited to the twenty packages enumerated in the roadmap's
Epic 4. The selection is download-count-weighted and biased toward packages
with unambiguous I/O effects. Additions beyond this set are explicitly a
non-goal in v0; the benchmark is expected to reveal which additions matter.

### `axios`

| Symbol | Effects | Rationale |
|---|---|---|
| `axios` | `net.https` | default callable makes an HTTP request |
| `axios.delete` | `net.https` |  |
| `axios.get` | `net.https` |  |
| `axios.head` | `net.https` |  |
| `axios.options` | `net.https` |  |
| `axios.patch` | `net.https` |  |
| `axios.post` | `net.https` |  |
| `axios.put` | `net.https` |  |
| `axios.request` | `net.https` |  |

### `node-fetch`

| Symbol | Effects | Rationale |
|---|---|---|
| `node-fetch` | `net.https` | drop-in for Web fetch |

### `got`

| Symbol | Effects | Rationale |
|---|---|---|
| `got` | `net.https` | default callable |
| `got.delete` | `net.https` |  |
| `got.get` | `net.https` |  |
| `got.head` | `net.https` |  |
| `got.patch` | `net.https` |  |
| `got.post` | `net.https` |  |
| `got.put` | `net.https` |  |

### `ky`

| Symbol | Effects | Rationale |
|---|---|---|
| `ky` | `net.https` | default callable |
| `ky.delete` | `net.https` |  |
| `ky.get` | `net.https` |  |
| `ky.head` | `net.https` |  |
| `ky.patch` | `net.https` |  |
| `ky.post` | `net.https` |  |
| `ky.put` | `net.https` |  |

### `pg`

| Symbol | Effects | Rationale |
|---|---|---|
| `pg.Client.connect` | `net.tcp` |  |
| `pg.Client.end` | `net.tcp` |  |
| `pg.Client.query` | `net.tcp` |  |
| `pg.Pool.connect` | `net.tcp` |  |
| `pg.Pool.end` | `net.tcp` |  |
| `pg.Pool.query` | `net.tcp` |  |

### `mysql2`

| Symbol | Effects | Rationale |
|---|---|---|
| `mysql2.Connection.end` | `net.tcp` |  |
| `mysql2.Connection.execute` | `net.tcp` |  |
| `mysql2.Connection.query` | `net.tcp` |  |
| `mysql2.createConnection` | `net.tcp` |  |
| `mysql2.createPool` | `net.tcp` |  |
| `mysql2.Pool.end` | `net.tcp` |  |
| `mysql2.Pool.execute` | `net.tcp` |  |
| `mysql2.Pool.query` | `net.tcp` |  |

### `redis`

| Symbol | Effects | Rationale |
|---|---|---|
| `redis.createClient` | `net.tcp` |  |
| `redis.RedisClient.connect` | `net.tcp` |  |
| `redis.RedisClient.del` | `net.tcp` |  |
| `redis.RedisClient.get` | `net.tcp` |  |
| `redis.RedisClient.quit` | `net.tcp` |  |
| `redis.RedisClient.set` | `net.tcp` |  |

### `ioredis`

| Symbol | Effects | Rationale |
|---|---|---|
| `ioredis` | `net.tcp` | constructor opens a connection |
| `ioredis.Redis.del` | `net.tcp` |  |
| `ioredis.Redis.get` | `net.tcp` |  |
| `ioredis.Redis.quit` | `net.tcp` |  |
| `ioredis.Redis.set` | `net.tcp` |  |

### `mongoose`

| Symbol | Effects | Rationale |
|---|---|---|
| `mongoose.connect` | `net.tcp` |  |
| `mongoose.disconnect` | `net.tcp` |  |
| `mongoose.Model.create` | `net.tcp` |  |
| `mongoose.Model.deleteMany` | `net.tcp` |  |
| `mongoose.Model.deleteOne` | `net.tcp` |  |
| `mongoose.Model.find` | `net.tcp` |  |
| `mongoose.Model.findById` | `net.tcp` |  |
| `mongoose.Model.findOne` | `net.tcp` |  |
| `mongoose.Model.updateMany` | `net.tcp` |  |
| `mongoose.Model.updateOne` | `net.tcp` |  |

### `prisma`

| Symbol | Effects | Rationale |
|---|---|---|
| `prisma.PrismaClient` | `net.tcp` | constructor may lazily open connection |
| `prisma.PrismaClient.$connect` | `net.tcp` |  |
| `prisma.PrismaClient.$disconnect` | `net.tcp` |  |
| `prisma.PrismaClient.$executeRaw` | `net.tcp` |  |
| `prisma.PrismaClient.$queryRaw` | `net.tcp` |  |
| `prisma.PrismaClient.$transaction` | `net.tcp` |  |

### `nodemailer`

| Symbol | Effects | Rationale |
|---|---|---|
| `nodemailer.createTransport` | `net.tcp` |  |
| `nodemailer.Transporter.close` | `net.tcp` |  |
| `nodemailer.Transporter.sendMail` | `net.tcp` |  |
| `nodemailer.Transporter.verify` | `net.tcp` |  |

### `express`

| Symbol | Effects | Rationale |
|---|---|---|
| `express.Application.listen` | `net.http` | binds listening socket; handler effects analyzed separately |

### `winston`

| Symbol | Effects | Rationale |
|---|---|---|
| `winston.Logger.debug` | `log` |  |
| `winston.Logger.error` | `log` |  |
| `winston.Logger.info` | `log` |  |
| `winston.Logger.log` | `log` |  |
| `winston.Logger.verbose` | `log` |  |
| `winston.Logger.warn` | `log` |  |

### `pino`

| Symbol | Effects | Rationale |
|---|---|---|
| `pino.Logger.debug` | `log` |  |
| `pino.Logger.error` | `log` |  |
| `pino.Logger.fatal` | `log` |  |
| `pino.Logger.info` | `log` |  |
| `pino.Logger.trace` | `log` |  |
| `pino.Logger.warn` | `log` |  |

### `dotenv`

| Symbol | Effects | Rationale |
|---|---|---|
| `dotenv.config` | `fs.read`, `proc.env` | reads .env file and mutates process.env |
| `dotenv.parse` | `fs.read` | parses but does not mutate env |

### `node-cron`

| Symbol | Effects | Rationale |
|---|---|---|
| `node-cron.schedule` | `time.sleep` | registers a recurring timer |
| `node-cron.validate` | _(pure)_ | known-pure validator |

### `ws`

| Symbol | Effects | Rationale |
|---|---|---|
| `ws.WebSocket` | `net.https` | constructor opens socket |
| `ws.WebSocket.close` | `net.https` |  |
| `ws.WebSocket.send` | `net.https` |  |
| `ws.WebSocketServer` | `net.https` | constructor binds listening socket |

### `socket.io`

| Symbol | Effects | Rationale |
|---|---|---|
| `socket.io` | `net.https` | default callable creates Server that listens |
| `socket.io.Server` | `net.https` |  |
| `socket.io.Server.emit` | `net.https` |  |
| `socket.io.Server.listen` | `net.https` |  |

### `bull`

| Symbol | Effects | Rationale |
|---|---|---|
| `bull.Queue` | `net.tcp` | constructor connects to Redis backend |
| `bull.Queue.add` | `net.tcp` |  |
| `bull.Queue.close` | `net.tcp` |  |
| `bull.Queue.process` | `net.tcp` |  |

### `jsonwebtoken`

| Symbol | Effects | Rationale |
|---|---|---|
| `jsonwebtoken.sign` | `rand` | asymmetric algorithms require CSPRNG; HMAC does not, but we mark conservatively |

## Extending the map

```json
{
  "effectMap": {
    "my-internal-logger.log": { "effects": ["log"] },
    "./src/db/client.query": { "effects": ["net.tcp", "log"] },
    "fetch": { "effects": ["net.http"] }
  }
}
```

User entries are merged at load time; a user key with the same name as a
built-in key replaces the built-in. This is deliberate: if an in-house
wrapper around `fetch` should be treated as `net.http` only, the user can
say so without touching source.

---

Generated from `hewg-ts/stdlib/effect-map.json`. Run `bun run gen:effect-map-doc`
from `hewg-ts/` to regenerate.
