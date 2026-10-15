import type { Params, ProjectFile } from "./types"

interface Ex {
  id: string
  title: string
  blurb: string
  nodes: [id: string, tool: string, x: number, y: number, params?: Params][]
  /** "from.port>to.port" or "from.port>to.param:name" */
  links: string[]
}

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE4MDAwMDAwMDB9.fake-signature"

export const EXAMPLES: Ex[] = [
  {
    id: "base64",
    title: "Base64 round trip",
    blurb: "Encode text, then decode it again. Edit the text and watch both ends update.",
    nodes: [
      ["a", "input:text", 64, 64, { text: "Hello, Bazkia!" }],
      ["b", "data:toBase64", 424, 64],
      ["c", "output:display", 784, 64],
      ["d", "data:fromBase64", 424, 328],
      ["e", "output:display", 784, 328],
    ],
    links: ["a.out>b.in", "b.out>c.in", "b.out>d.in", "d.out>e.in"],
  },
  {
    id: "hash",
    title: "Hash and compare",
    blurb: "SHA-256 and MD5 of the same input, then check a digest you were given.",
    nodes: [
      ["a", "input:text", 64, 64, { text: "abc" }],
      ["b", "hash:sha256", 424, 40],
      ["c", "hash:md5", 424, 320],
      ["d", "output:display", 784, 40],
      ["e", "output:display", 784, 320],
      ["f", "input:text", 424, 560, { text: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" }],
      ["g", "hash:compare", 784, 560],
    ],
    links: ["a.out>b.in", "a.out>c.in", "b.out>d.in", "c.out>e.in", "b.out>g.a", "f.out>g.b"],
  },
  {
    id: "jwt",
    title: "Inspect a JWT",
    blurb: "Split a token into header and payload, pull out the expiry and turn it into a date.",
    nodes: [
      ["a", "input:text", 64, 64, { text: JWT }],
      ["b", "crypto:jwtDecode", 424, 64],
      ["c", "output:display", 784, 40],
      ["d", "code:jsonPath", 784, 296, { path: "$.exp" }],
      ["e", "time:fromUnix", 1144, 296, { tz: "UTC" }],
      ["f", "output:display", 1144, 560],
    ],
    links: ["a.out>b.in", "b.payload>c.in", "b.payload>d.in", "d.out>e.in", "e.out>f.in"],
  },
  {
    id: "hmac",
    title: "HMAC with a wired key",
    blurb: "The key is not typed into the HMAC node. It arrives over a link into the key parameter.",
    nodes: [
      ["a", "input:text", 64, 64, { text: "what do ya want for nothing?" }],
      ["k", "input:text", 64, 320, { text: "Jefe" }],
      ["h", "hash:hmac", 424, 128],
      ["d", "output:display", 784, 128],
    ],
    links: ["a.out>h.in", "k.out>h.param:key", "h.out>d.in"],
  },
  {
    id: "magic",
    title: "Unknown blob",
    blurb: "Nobody told you what this is. Magic tries decoders until something readable falls out.",
    nodes: [
      ["a", "input:text", 64, 64, { text: "JTY4JTY1JTZDJTZDJTZGJTJDJTIwJTc3JTZGJTcyJTZDJTY0JTIx" }],
      ["m", "analysis:magic", 424, 64],
      ["d", "output:display", 784, 64],
      ["r", "output:display", 784, 296],
    ],
    links: ["a.out>m.in", "m.best>d.in", "m.recipe>r.in"],
  },
  {
    id: "totp",
    title: "Live authenticator code",
    blurb: "A fresh secret and the code it produces right now, refreshed every second.",
    nodes: [
      ["s", "gen:totpSecret", 64, 64],
      ["t", "crypto:totp", 424, 64],
      ["d", "output:display", 784, 64],
    ],
    links: ["s.out>t.in", "t.out>d.in"],
  },
  {
    id: "subnet",
    title: "Subnet check",
    blurb: "Describe a CIDR block, then test whether an address belongs to it.",
    nodes: [
      ["a", "input:text", 64, 64, { text: "10.20.30.0/22" }],
      ["b", "net:cidr", 424, 64],
      ["c", "output:display", 784, 64],
      ["i", "input:text", 64, 360, { text: "10.20.33.7" }],
      ["j", "net:inCidr", 424, 360, { cidr: "10.20.32.0/22" }],
      ["k", "output:display", 784, 360],
    ],
    links: ["a.out>b.in", "b.out>c.in", "i.out>j.in", "j.out>k.in"],
  },
]

export function exampleProject(ex: Ex): ProjectFile {
  return {
    format: "bazkia",
    version: 1,
    name: ex.title,
    nodes: ex.nodes.map(([id, tool, x, y, params]) => ({ id, tool, x, y, params: params ?? {} })),
    edges: ex.links.map((l, i) => {
      const [from, to] = l.split(">")
      const [s, sp] = from.split(".")
      const [t, tp] = to.split(".")
      return {
        id: `x${i}`,
        source: s,
        sourceHandle: `out:${sp}`,
        target: t,
        targetHandle: tp.startsWith("param:") ? tp : `in:${tp}`,
      }
    }),
  }
}
