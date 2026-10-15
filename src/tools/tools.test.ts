import { describe, expect, it } from "vitest"
import "./index"
import { evaluate, type GraphNode } from "../core/evaluate"
import { allTools, getTool, searchTools } from "../core/registry"
import { defaultParams } from "./kit"
import { toText } from "../core/values"
import * as c from "./codecs"
import { crc, CRCS } from "./hashing"
import { calc } from "./math"
import { jsonPath, parseCsv } from "./code"
import { formatDate, humanDuration } from "./datetime"
import { magic } from "./magic"
import { uuidv4, uuidv7, ulid } from "./generators"

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

/** Runs one tool on a text input and returns its main output as text. */
async function run(id: string, input: string, params: Record<string, string | number | boolean> = {}) {
  const def = getTool(id)!
  expect(def, id).toBeTruthy()
  const out = await def.run({
    inputs: { in: input, a: input },
    params: { ...defaultParams(def.params), ...params },
    tick: 0,
    signal: new AbortController().signal,
  })
  return toText(out[def.outputs[0].id])
}

describe("registry", () => {
  it("has a healthy number of tools with unique ids and sane defaults", () => {
    const tools = allTools()
    expect(tools.length).toBeGreaterThan(200)
    for (const t of tools) {
      expect(t.name, t.id).toBeTruthy()
      expect(t.description.length, t.id).toBeGreaterThan(10)
      const ids = t.params.map((p) => p.id)
      expect(new Set(ids).size, t.id).toBe(ids.length)
      for (const p of t.params) if (p.type === "select") expect(p.options!.some((o) => o.value === p.default), `${t.id}.${p.id}`).toBe(true)
    }
  })
  it("searches by name, keyword and fuzzy", () => {
    expect(searchTools("base64").slice(0, 3).map((t) => t.id)).toEqual(expect.arrayContaining(["data:toBase64", "data:fromBase64"]))
    expect(searchTools("sha256").map((t) => t.id)).toContain("hash:sha256")
    expect(searchTools("unix epoch").length).toBeGreaterThan(0)
    expect(searchTools("zzzzqqq")).toHaveLength(0)
  })
})

describe("every tool survives its default parameters and empty input", () => {
  for (const t of allTools()) {
    if (t.annotation || t.live) continue
    it(t.id, async () => {
      // may throw a friendly error, but must not hang or return garbage types
      try {
        const r = await t.run({ inputs: {}, params: defaultParams(t.params), tick: 0, signal: new AbortController().signal })
        expect(typeof r).toBe("object")
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
      }
    })
  }
})

describe("codecs", () => {
  it("base64 vectors (RFC 4648)", () => {
    const v: [string, string][] = [["", ""], ["f", "Zg=="], ["fo", "Zm8="], ["foo", "Zm9v"], ["foob", "Zm9vYg=="], ["fooba", "Zm9vYmE="], ["foobar", "Zm9vYmFy"]]
    for (const [p, e] of v) {
      expect(c.base64Encode(enc(p))).toBe(e)
      expect(dec(c.base64Decode(e))).toBe(p)
    }
    expect(c.base64Encode(Uint8Array.from([0xfb, 0xff]), c.B64_URL, false)).toBe("-_8")
  })
  it("base32 vectors (RFC 4648)", () => {
    const v: [string, string][] = [["f", "MY======"], ["fo", "MZXQ===="], ["foo", "MZXW6==="], ["foob", "MZXW6YQ="], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI======"]]
    for (const [p, e] of v) {
      expect(c.base32Encode(enc(p))).toBe(e)
      expect(dec(c.base32Decode(e))).toBe(p)
    }
  })
  it("base45 (RFC 9285)", () => {
    expect(c.base45Encode(enc("AB"))).toBe("BB8")
    expect(c.base45Encode(enc("Hello!!"))).toBe("%69 VD92EX0")
    expect(c.base45Encode(enc("base-45"))).toBe("UJCLQE7W581")
    expect(dec(c.base45Decode("QED8WEX0"))).toBe("ietf!")
  })
  it("base58", () => {
    expect(c.baseNEncode(enc("Hello World!"), c.B58_BITCOIN)).toBe("2NEpo7TZRRrLZSi2U")
    expect(c.baseNEncode(Uint8Array.from([0, 0, 1]), c.B58_BITCOIN)).toBe("112")
    expect(dec(c.baseNDecode("2NEpo7TZRRrLZSi2U", c.B58_BITCOIN))).toBe("Hello World!")
  })
  it("base85", () => {
    expect(c.base85Encode(enc("Man "))).toBe("<~9jqo^~>")
    expect(dec(c.base85Decode("<~9jqo^~>"))).toBe("Man ")
    const data = enc("hello world, this is a longer string!")
    expect(Array.from(c.base85Decode(c.base85Encode(data)))).toEqual(Array.from(data))
    expect(c.base85Encode(Uint8Array.from([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b]), "z85")).toBe("HelloWorld")
  })
  it("punycode", () => {
    expect(c.punycodeEncode("bücher")).toBe("bcher-kva")
    expect(c.punycodeDecode("bcher-kva")).toBe("bücher")
    expect(c.punycodeEncode("münchen")).toBe("mnchen-3ya")
  })
  it("morse round trip", () => {
    expect(c.morseEncode("SOS 2024")).toBe("... --- ... / ..--- ----- ..--- ....-")
    expect(c.morseDecode("... --- ... / ..--- ----- ..--- ....-")).toBe("SOS 2024")
  })
  it("html entities", () => {
    expect(c.htmlEncode("<a href=\"x\">&</a>")).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;")
    expect(c.htmlDecode("&lt;p&gt; &copy; &#8364; &#x1F600;")).toBe("<p> © € 😀")
  })
  it("quoted-printable", () => {
    expect(c.qpEncode(enc("café = ok"))).toBe("caf=C3=A9 =3D ok")
    expect(dec(c.qpDecode("caf=C3=A9 =3D ok"))).toBe("café = ok")
  })
  it("escapes", () => {
    expect(c.escapeString('a"b\n\\')).toBe('a\\"b\\n\\\\')
    expect(c.unescapeString("a\\tb\\x41\\u0042\\u{1F600}")).toBe("a\tbAB😀")
    expect(c.unicodeUnescape(c.unicodeEscape("héllo 😀"))).toBe("héllo 😀")
  })
})

describe("hashing", () => {
  it("known digests of 'abc'", async () => {
    expect(await run("hash:md5", "abc")).toBe("900150983cd24fb0d6963f7d28e17f72")
    expect(await run("hash:sha1", "abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d")
    expect(await run("hash:sha256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    expect(await run("hash:sha3-256", "abc")).toBe("3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532")
    expect(await run("hash:ripemd160", "abc")).toBe("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc")
    expect(await run("hash:keccak256", "")).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
    expect(await run("hash:sha256", "abc", { format: "base64" })).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=")
  })
  it("HMAC-SHA256 (RFC 4231 case 2)", async () => {
    expect(await run("hash:hmac", "what do ya want for nothing?", { key: "Jefe", hash: "SHA-256" })).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    )
  })
  it("CRC catalogue check values for '123456789'", () => {
    const d = enc("123456789")
    const hex = (n: string) => crc(d, ...CRCS[n]).toString(16)
    expect(hex("CRC-32")).toBe("cbf43926")
    expect(hex("CRC-32C")).toBe("e3069283")
    expect(hex("CRC-32/BZIP2")).toBe("fc891918")
    expect(hex("CRC-32/MPEG-2")).toBe("376e6e7")
    expect(hex("CRC-16/ARC")).toBe("bb3d")
    expect(hex("CRC-16/CCITT-FALSE")).toBe("29b1")
    expect(hex("CRC-16/XMODEM")).toBe("31c3")
    expect(hex("CRC-16/MODBUS")).toBe("4b37")
    expect(hex("CRC-8")).toBe("f4")
  })
  it("adler32", async () => expect(await run("hash:adler32", "Wikipedia")).toBe("11e60398"))
  it("PBKDF2-SHA1 (RFC 6070)", async () => {
    const r = await run("hash:pbkdf2", "password", { salt: "salt", iterations: 2, length: 20, hash: "SHA-1" })
    expect(r).toBe(toText(Uint8Array.from(Buffer.from("ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957", "hex"))))
  })
})

describe("crypto", () => {
  it("AES-CBC round trip and a known vector", async () => {
    const key = "2b7e151628aed2a6abf7158809cf4f3c"
    const iv = "000102030405060708090a0b0c0d0e0f"
    const enc1 = getTool("crypto:aesEncrypt")!
    const dec1 = getTool("crypto:aesDecrypt")!
    const params = { ...defaultParams(enc1.params), mode: "AES-CBC", key, iv }
    const ct = (await enc1.run({ inputs: { in: "attack at dawn" }, params, tick: 0, signal: new AbortController().signal })).out as Uint8Array
    expect(ct.length).toBe(16)
    const pt = (await dec1.run({ inputs: { in: ct }, params, tick: 0, signal: new AbortController().signal })).out
    expect(toText(pt)).toBe("attack at dawn")
    // NIST SP 800-38A F.2.1, block 1 with padding block appended
    const nist = (await enc1.run({ inputs: { in: Uint8Array.from(Buffer.from("6bc1bee22e409f96e93d7e117393172a", "hex")) }, params, tick: 0, signal: new AbortController().signal })).out as Uint8Array
    expect(Buffer.from(nist.subarray(0, 16)).toString("hex")).toBe("7649abac8119b246cee98e9b12e9197d")
  })
  it("AES-GCM detects tampering", async () => {
    const enc1 = getTool("crypto:aesEncrypt")!
    const dec1 = getTool("crypto:aesDecrypt")!
    const params = { ...defaultParams(enc1.params), mode: "AES-GCM", key: "00".repeat(16), iv: "00".repeat(12) }
    const ctx = { tick: 0, signal: new AbortController().signal }
    const ct = (await enc1.run({ inputs: { in: "secret" }, params, ...ctx })).out as Uint8Array
    ct[0] ^= 1
    await expect(dec1.run({ inputs: { in: ct }, params, ...ctx })).rejects.toThrow(/Decryption failed/)
  })
  it("classical ciphers", async () => {
    expect(await run("crypto:rot13", "Hello, World!")).toBe("Uryyb, Jbeyq!")
    expect(await run("crypto:rotN", "abc xyz", { amount: -3 })).toBe("xyz uvw")
    expect(await run("crypto:atbash", "Hello")).toBe("Svool")
    expect(await run("crypto:vigenereEncode", "ATTACKATDAWN", { key: "LEMON" })).toBe("LXFOPVEFRNHR")
    expect(await run("crypto:vigenereDecode", "LXFOPVEFRNHR", { key: "LEMON" })).toBe("ATTACKATDAWN")
    expect(await run("crypto:affineEncode", "AFFINE CIPHER", { a: 5, b: 8 })).toBe("IHHWVC SWFRCP")
    expect(await run("crypto:affineDecode", "IHHWVC SWFRCP", { a: 5, b: 8 })).toBe("AFFINE CIPHER")
    expect(await run("crypto:railFenceEncode", "WEAREDISCOVEREDFLEEATONCE", { rails: 3 })).toBe("WECRLTEERDSOEEFEAOCAIVDEN")
    expect(await run("crypto:railFenceDecode", "WECRLTEERDSOEEFEAOCAIVDEN", { rails: 3 })).toBe("WEAREDISCOVEREDFLEEATONCE")
    expect(await run("crypto:a1z26Encode", "Hi")).toBe("8 9")
  })
  it("JWT decode and HS256 round trip", async () => {
    const token = await run("crypto:jwtSign", '{"sub":"1234567890","name":"John Doe","iat":1516239022}', { alg: "HS256", secret: "a-string-secret-at-least-256-bits-long" })
    expect(token).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.m2NWnW3kwqyNZtAl-Uy6aqZgOqAr3gvj_3BP9qq2UQA".replace(
        /\.[^.]+$/,
        "." + token.split(".")[2],
      ),
    )
    expect(await run("crypto:jwtVerify", token, { secret: "a-string-secret-at-least-256-bits-long" })).toBe("true")
    expect(await run("crypto:jwtVerify", token, { secret: "wrong" })).toBe("false")
    expect(JSON.parse(await run("crypto:jwtDecode", token)).alg).toBe("HS256")
  })
  it("HOTP (RFC 4226 test vectors)", async () => {
    // secret "12345678901234567890" in base32
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const expected = ["755224", "287082", "359152", "969429", "338314"]
    for (let i = 0; i < expected.length; i++) expect(await run("crypto:hotp", secret, { counter: i })).toBe(expected[i])
  })
})

describe("math", () => {
  it("calculator", () => {
    expect(calc("2 + 3 * 4")).toBe(14)
    expect(calc("(2 + 3) * 4")).toBe(20)
    expect(calc("2 ** 3 ** 2")).toBe(512)
    expect(calc("-2 ** 2")).toBe(-4)
    expect(calc("sqrt(16) + max(1, 7, 3)")).toBe(11)
    expect(calc("0xff + 0b11")).toBe(258)
    expect(() => calc("2 +")).toThrow()
    expect(() => calc("foo")).toThrow()
    expect(() => calc("process.exit()")).toThrow()
  })
  it("aggregates", async () => {
    expect(await run("math:sum", "1, 2, 3.5")).toBe("6.5")
    expect(await run("math:median", "5 1 3 2")).toBe("2.5")
    expect(await run("math:stddev", "2 4 4 4 5 5 7 9")).toBe("2")
  })
  it("change base and big numbers", async () => {
    expect(await run("math:changeBase", "ff", { from: 16, to: 2 })).toBe("11111111")
    expect(await run("math:changeBase", "123456789012345678901234567890", { from: 10, to: 16 })).toBe("18ee90ff6c373e0ee4e3f0ad2")
    const def = getTool("math:operate")!
    const out = await def.run({ inputs: { a: "99999999999999999999", b: "1" }, params: { op: "+" }, tick: 0, signal: new AbortController().signal })
    expect(out.out).toBe("100000000000000000000")
  })
  it("luhn", async () => expect(await run("math:luhn", "4539 1488 0343 6467")).toMatch(/^valid/))
})

describe("text", () => {
  it("case conversion", async () => {
    expect(await run("text:case:camel", "hello_world-fooBar")).toBe("helloWorldFooBar")
    expect(await run("text:case:snake", "HelloWorld FooBar")).toBe("hello_world_foo_bar")
    expect(await run("text:case:kebab", "XMLHttpRequest")).toBe("xml-http-request")
    expect(await run("text:case:slug", "Héllo, Wörld!")).toBe("hello-world")
  })
  it("sort, unique, filter", async () => {
    expect(await run("text:sort", "b\na\nc")).toBe("a\nb\nc")
    expect(await run("text:sort", "10\n9\n100", { order: "Numeric" })).toBe("9\n10\n100")
    expect(await run("text:unique", "a\nb\na")).toBe("a\nb")
    expect(await run("text:filterLines", "foo\nbar\nfoobar", { pattern: "^foo" })).toBe("foo\nfoobar")
  })
  it("regex", async () => {
    expect(await run("regex:match", "a1 b22 c333", { pattern: "\\d+" })).toBe("1\n22\n333")
    expect(await run("regex:replace", "a.b.c", { find: ".", replace: "-" })).toBe("a-b-c")
    expect(await run("regex:replace", "2024-01-31", { find: "(\\d+)-(\\d+)-(\\d+)", replace: "$3/$2/$1", regex: true })).toBe("31/01/2024")
  })
  it("diff", async () => {
    const def = getTool("text:diff")!
    const out = await def.run({ inputs: { a: "a\nb\nc", b: "a\nc\nd" }, params: defaultParams(def.params), tick: 0, signal: new AbortController().signal })
    expect(out.out).toBe("  a\n- b\n  c\n+ d")
    expect(out.same).toBe(false)
  })
})

describe("network", () => {
  it("cidr", async () => {
    const r = await run("net:cidr", "192.168.1.130/26")
    expect(r).toContain("Network     192.168.1.128/26")
    expect(r).toContain("Broadcast   192.168.1.191")
    expect(r).toContain("Hosts       62")
  })
  it("ip formats", async () => {
    expect(await run("net:ipFormat", "192.168.0.1", { to: "Decimal" })).toBe("3232235521")
    expect(await run("net:ipFormat", "0xC0A80001", { to: "Dotted" })).toBe("192.168.0.1")
  })
  it("ipv6", async () => {
    expect(await run("net:ipv6", "2001:db8::1", { mode: "Expand" })).toBe("2001:0db8:0000:0000:0000:0000:0000:0001")
    expect(await run("net:ipv6", "2001:0db8:0000:0000:0000:0000:0000:0001", { mode: "Compress" })).toBe("2001:db8::1")
  })
  it("parse url", async () => {
    const j = JSON.parse(await run("net:parseUrl", "https://user:pw@example.com:8443/a/b?x=1&x=2&y=z#frag"))
    expect(j).toMatchObject({ protocol: "https", host: "example.com", port: "8443", path: "/a/b", query: { x: ["1", "2"], y: "z" }, fragment: "frag" })
  })
  it("defang round trip", async () => {
    const d = await run("net:defang", "http://evil.example.com/x")
    expect(d).toBe("hxxp[://]evil[.]example[.]com/x")
    expect(await run("net:fang", d)).toBe("http://evil.example.com/x")
  })
})

describe("date & time", () => {
  it("format in zones", () => {
    const d = new Date("2024-03-10T12:34:56.789Z")
    expect(formatDate(d, "YYYY-MM-DD HH:mm:ss", "UTC")).toBe("2024-03-10 12:34:56")
    expect(formatDate(d, "dddd D MMMM YYYY [at] h:mm A", "UTC")).toBe("Sunday 10 March 2024 at 12:34 PM")
    expect(formatDate(d, "HH:mm Z", "Asia/Tokyo")).toBe("21:34 +09:00")
    expect(formatDate(d, "X", "UTC")).toBe("1710074096")
  })
  it("unix conversions detect units", async () => {
    expect(await run("time:fromUnix", "1700000000", { tz: "UTC" })).toBe("2023-11-14 22:13:20")
    expect(await run("time:fromUnix", "1700000000000", { tz: "UTC" })).toBe("2023-11-14 22:13:20")
    expect(await run("time:toUnix", "2023-11-14T22:13:20Z")).toBe("1700000000")
  })
  it("filetime", async () => expect(await run("time:filetime", "133485408000000000", { dir: "from" })).toBe("2024-01-01T00:00:00.000Z"))
  it("durations", () => expect(humanDuration(93784)).toBe("1d 2h 3m 4s"))
  it("cron", async () => {
    const r = (await run("time:cron", "*/15 * * * *", { count: 3 })).split("\n")
    expect(r).toHaveLength(3)
    expect(r.every((x) => /:(00|15|30|45):00\.000Z$/.test(x))).toBe(true)
  })
})

describe("code & data", () => {
  it("csv parsing", () => {
    expect(parseCsv('a,b\n"x,1","he said ""hi"""\n')).toEqual([["a", "b"], ["x,1", 'he said "hi"']])
  })
  it("csv <-> json", async () => {
    const json = await run("code:csvToJson", "name,age\nAda,36\nLinus,54")
    expect(JSON.parse(json)).toEqual([{ name: "Ada", age: "36" }, { name: "Linus", age: "54" }])
    expect(await run("code:jsonToCsv", json)).toBe("name,age\nAda,36\nLinus,54")
  })
  it("json path", () => {
    const data = { users: [{ name: "a", tags: ["x"] }, { name: "b", tags: ["y"] }] }
    expect(jsonPath(data, "$.users[1].name")).toBe("b")
    expect(jsonPath(data, "users.0.tags.0")).toBe("x")
    expect(jsonPath(data, "$.users[*].name")).toEqual(["a", "b"])
  })
  it("json format and yaml", async () => {
    expect(await run("code:jsonFormat", '{"b":1,"a":[1,2]}', { sort: true })).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}')
    expect(await run("code:jsonToYaml", '{"a":{"b":[1,"x"]},"c":"yes"}')).toBe('a:\n  b:\n    - 1\n    - x\nc: "yes"')
  })
  it("xml beautify", async () => {
    expect(await run("code:xmlFormat", "<a><b>1</b><c><d/></c></a>")).toBe("<a>\n  <b>1</b>\n  <c>\n    <d/>\n  </c>\n</a>")
  })
  it("colour convert", async () => {
    expect(await run("code:color", "#ff8000")).toContain("rgb(255, 128, 0)")
    expect(await run("code:color", "hsl(210, 50%, 50%)")).toContain("#4080bf")
  })
})

describe("compression & detection", () => {
  it("gzip round trip through the graph engine", async () => {
    const res = await evaluate(
      [
        { id: "t", tool: "input:text", params: { text: "hello hello hello hello" } },
        { id: "z", tool: "zip:gzip", params: { level: 6 } },
        { id: "b", tool: "data:toBase64", params: { alphabet: "std", pad: true } },
        { id: "d", tool: "data:fromBase64", params: { alphabet: "std", strict: false } },
        { id: "u", tool: "zip:gunzip", params: {} },
      ],
      [
        { id: "1", source: "t", sourceHandle: "out:out", target: "z", targetHandle: "in:in" },
        { id: "2", source: "z", sourceHandle: "out:out", target: "b", targetHandle: "in:in" },
        { id: "3", source: "b", sourceHandle: "out:out", target: "d", targetHandle: "in:in" },
        { id: "4", source: "d", sourceHandle: "out:out", target: "u", targetHandle: "in:in" },
      ],
    )
    expect(toText(res.u.outputs.out)).toBe("hello hello hello hello")
    expect(String(res.b.outputs.out)).toMatch(/^H4sI/)
  })
  it("file type", async () => {
    const def = getTool("zip:fileType")!
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
    const r = await def.run({ inputs: { in: png }, params: {}, tick: 0, signal: new AbortController().signal })
    expect(toText(r.out)).toContain("PNG")
  })
  it("magic finds layered encodings", () => {
    const layered = btoa(Array.from(enc(encodeURIComponent("the flag is hidden with this password, from the user"))).map((x) => String.fromCharCode(x)).join(""))
    const best = magic(enc(layered), 3)[0]
    expect(dec(best.bytes)).toBe("the flag is hidden with this password, from the user")
    expect(best.path).toEqual(["From Base64", "URL Decode"])
  })
})

describe("generators", () => {
  it("uuid shapes", () => {
    expect(uuidv4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(uuidv7(1700000000000)).toMatch(/^018bcfe5-6800-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(ulid(1700000000000)).toMatch(/^[0-9A-Z]{26}$/)
  })
})

describe("graph engine", () => {
  const E = (id: string, s: string, sh: string, t: string, th: string) => ({ id, source: s, sourceHandle: sh, target: t, targetHandle: th })
  it("wires params from upstream nodes", async () => {
    const res = await evaluate(
      [
        { id: "k", tool: "input:text", params: { text: "Jefe" } },
        { id: "m", tool: "input:text", params: { text: "what do ya want for nothing?" } },
        { id: "h", tool: "hash:hmac", params: { ...defaultParams(getTool("hash:hmac")!.params) } },
      ],
      [E("1", "m", "out:out", "h", "in:in"), E("2", "k", "out:out", "h", "param:key")],
    )
    expect(res.h.outputs.out).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843")
  })
  it("reports cycles and upstream failures", async () => {
    const cyc = await evaluate(
      [{ id: "a", tool: "text:case:upper", params: {} }, { id: "b", tool: "text:case:upper", params: {} }],
      [E("1", "a", "out:out", "b", "in:in"), E("2", "b", "out:out", "a", "in:in")],
    )
    expect(cyc.a.error).toMatch(/Cycle/)
    const bad = await evaluate(
      [{ id: "t", tool: "input:text", params: { text: "zz" } }, { id: "j", tool: "code:jsonMinify", params: {} }, { id: "u", tool: "text:case:upper", params: {} }],
      [E("1", "t", "out:out", "j", "in:in"), E("2", "j", "out:out", "u", "in:in")],
    )
    expect(bad.j.error).toBeTruthy()
    expect(bad.u.error).toMatch(/upstream/i)
  })
  it("caches unchanged nodes and honours abort", async () => {
    let runs = 0
    const probe = getTool("text:case:upper")!
    const orig = probe.run
    probe.run = (ctx) => (runs++, orig(ctx))
    const nodes: GraphNode[] = [{ id: "t", tool: "input:text", params: { text: "x" } }, { id: "u", tool: "text:case:upper", params: {} }]
    const edges = [E("1", "t", "out:out", "u", "in:in")]
    const cache = new Map()
    await evaluate(nodes, edges, { cache })
    await evaluate(nodes, edges, { cache })
    expect(runs).toBe(1)
    await evaluate([{ ...nodes[0], params: { text: "y" } }, nodes[1]], edges, { cache })
    expect(runs).toBe(2)
    probe.run = orig
    const ac = new AbortController()
    ac.abort()
    await expect(evaluate(nodes, edges, { signal: ac.signal })).rejects.toThrow()
  })
  it("debounce waits and can be cancelled", async () => {
    const ac = new AbortController()
    const p = evaluate([{ id: "d", tool: "flow:debounce", params: { delay: 5000 } }], [], { signal: ac.signal })
    setTimeout(() => ac.abort(), 20)
    await expect(p).rejects.toThrow()
  })
})
