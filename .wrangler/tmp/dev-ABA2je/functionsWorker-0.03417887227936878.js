var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-mKFdiF/functionsWorker-0.03417887227936878.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var KEY = "visitor:agg:v1";
async function readAgg(kv) {
  const raw = await kv.get(KEY, "json");
  if (!raw || typeof raw !== "object") {
    return { total: 0, byCountry: {}, byCityKey: {} };
  }
  const o = raw;
  return {
    total: Number(o.total) || 0,
    byCountry: o.byCountry ?? {},
    byCityKey: o.byCityKey ?? {}
  };
}
__name(readAgg, "readAgg");
__name2(readAgg, "readAgg");
async function writeAgg(kv, agg) {
  await kv.put(KEY, JSON.stringify(agg));
}
__name(writeAgg, "writeAgg");
__name2(writeAgg, "writeAgg");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
__name(json, "json");
__name2(json, "json");
function corsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(corsOptions, "corsOptions");
__name2(corsOptions, "corsOptions");
var onRequestOptions = /* @__PURE__ */ __name2(async () => corsOptions(), "onRequestOptions");
var onRequestGet = /* @__PURE__ */ __name2(async ({ request, env }) => {
  const secret = env.ADMIN_STATS_SECRET ?? "";
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!secret || token !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  if (!env.VISITOR_KV) {
    return json({ total: 0, countries: [], cities: [] });
  }
  const agg = await readAgg(env.VISITOR_KV);
  const countries = Object.entries(agg.byCountry).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  const cities = Object.values(agg.byCityKey).sort((a, b) => b.count - a.count);
  return json({ total: agg.total, countries, cities });
}, "onRequestGet");
async function createStripeCheckoutSession(input) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("line_items[0][price]", input.priceId);
  body.set("line_items[0][quantity]", String(input.quantity ?? 1));
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `Stripe HTTP ${res.status}`;
    return { ok: false, message: msg, status: res.status >= 400 && res.status < 600 ? res.status : 502 };
  }
  if (!data.url) {
    return { ok: false, message: "No checkout URL returned from Stripe." };
  }
  return { ok: true, url: data.url };
}
__name(createStripeCheckoutSession, "createStripeCheckoutSession");
__name2(createStripeCheckoutSession, "createStripeCheckoutSession");
var onRequestOptions2 = /* @__PURE__ */ __name2(async () => corsOptions(), "onRequestOptions");
var onRequestPost = /* @__PURE__ */ __name2(async ({ request, env }) => {
  const secret = env.STRIPE_SECRET_KEY?.trim();
  const defaultPrice = env.STRIPE_PRICE_ID?.trim();
  if (!secret || !defaultPrice) {
    return json(
      {
        ok: false,
        error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID on Cloudflare Pages."
      },
      503
    );
  }
  const priceId = defaultPrice;
  if (!priceId.startsWith("price_")) {
    return json({ ok: false, error: "STRIPE_PRICE_ID must be a Price id (price_\u2026)." }, 500);
  }
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/services/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/services?checkout=canceled`;
  const result = await createStripeCheckoutSession({
    secretKey: secret,
    priceId,
    successUrl,
    cancelUrl,
    quantity: 1
  });
  if (!result.ok) {
    return json({ ok: false, error: result.message }, result.status && result.status !== 200 ? result.status : 502);
  }
  return json({ ok: true, url: result.url });
}, "onRequestPost");
var MAP = {
  AD: [42.5462, 1.6016],
  AE: [23.4241, 53.8478],
  AF: [33.9391, 67.71],
  AG: [17.0608, -61.7964],
  AI: [18.2206, -63.0686],
  AL: [41.1533, 20.1683],
  AM: [40.0691, 45.0382],
  AO: [-11.2027, 17.8739],
  AR: [-38.4161, -63.6167],
  AS: [-14.2709, -170.1322],
  AT: [47.5162, 14.5501],
  AU: [-25.2744, 133.7751],
  AW: [12.5211, -69.9683],
  AX: [60.1785, 19.9156],
  AZ: [40.1431, 47.5769],
  BA: [43.9159, 17.6791],
  BB: [13.1939, -59.5432],
  BD: [23.685, 90.3563],
  BE: [50.5039, 4.4699],
  BF: [12.2383, -1.5616],
  BG: [42.7339, 25.4858],
  BH: [25.9304, 50.6378],
  BI: [-3.3731, 29.9189],
  BJ: [9.3077, 2.3158],
  BL: [17.9, -62.8333],
  BM: [32.3078, -64.7505],
  BN: [4.5353, 114.7277],
  BO: [-16.2902, -63.5887],
  BQ: [12.1784, -68.2385],
  BR: [-14.235, -51.9253],
  BS: [25.0343, -77.3963],
  BT: [27.5142, 90.4336],
  BW: [-22.3285, 24.6849],
  BY: [53.7098, 27.9534],
  BZ: [17.1899, -88.4976],
  CA: [56.1304, -106.3468],
  CC: [-12.1642, 96.871],
  CD: [-4.0383, 21.7587],
  CF: [6.6111, 20.9394],
  CG: [-0.228, 15.8277],
  CH: [46.8182, 8.2275],
  CI: [7.54, -5.5471],
  CK: [-21.2367, -159.7777],
  CL: [-35.6751, -71.543],
  CM: [7.3697, 12.3547],
  CN: [35.8617, 104.1954],
  CO: [4.5709, -74.2973],
  CR: [9.7489, -83.7534],
  CU: [21.5218, -77.7812],
  CV: [16.5388, -23.0418],
  CW: [12.1696, -68.99],
  CX: [-10.4475, 105.6904],
  CY: [35.1264, 33.4299],
  CZ: [49.8175, 15.473],
  DE: [51.1657, 10.4515],
  DJ: [11.8251, 42.5903],
  DK: [56.2639, 9.5018],
  DM: [15.415, -61.371],
  DO: [18.7357, -70.1627],
  DZ: [28.0339, 1.6596],
  EC: [-1.8312, -78.1834],
  EE: [58.5953, 25.0136],
  EG: [26.8206, 30.8025],
  EH: [24.2155, -12.8858],
  ER: [15.1794, 39.7823],
  ES: [40.4637, -3.7492],
  ET: [9.145, 40.4897],
  FI: [61.9241, 25.7482],
  FJ: [-17.7134, 178.065],
  FK: [-51.7963, -59.5236],
  FM: [7.4256, 150.5508],
  FO: [61.8926, -6.9118],
  FR: [46.2276, 2.2137],
  GA: [-0.8037, 11.6094],
  GB: [55.3781, -3.436],
  GD: [12.1165, -61.679],
  GE: [42.3154, 43.3569],
  GF: [3.9339, -53.1258],
  GG: [49.4657, -2.5853],
  GH: [7.9465, -1.0232],
  GI: [36.1408, -5.3536],
  GL: [71.7069, -42.6043],
  GM: [13.4432, -15.3101],
  GN: [9.9456, -9.6966],
  GP: [16.265, -61.551],
  GQ: [1.6508, 10.2679],
  GR: [39.0742, 21.8243],
  GS: [-54.4296, -36.5879],
  GT: [15.7835, -90.2308],
  GU: [13.4443, 144.7937],
  GW: [11.8037, -15.1804],
  GY: [4.8604, -58.9302],
  HK: [22.3193, 114.1694],
  HN: [15.2, -86.2419],
  HR: [45.1, 15.2],
  HT: [18.9712, -72.2852],
  HU: [47.1625, 19.5033],
  ID: [-0.7893, 113.9213],
  IE: [53.4129, -8.2439],
  IL: [31.0461, 34.8516],
  IM: [54.2361, -4.5481],
  IN: [20.5937, 78.9629],
  IO: [-6.3432, 71.8765],
  IQ: [33.2232, 43.6793],
  IR: [32.4279, 53.688],
  IS: [64.9631, -19.0208],
  IT: [41.8719, 12.5674],
  JE: [49.2144, -2.1312],
  JM: [18.1096, -77.2975],
  JO: [30.5852, 36.2384],
  JP: [36.2048, 138.2529],
  KE: [-0.0236, 37.9062],
  KG: [41.2044, 74.7661],
  KH: [12.5657, 104.991],
  KI: [-3.3704, -168.734],
  KM: [-11.875, 43.8722],
  KN: [17.3578, -62.783],
  KP: [40.3399, 127.5101],
  KR: [35.9078, 127.7669],
  KW: [29.3117, 47.4818],
  KY: [19.3133, -81.2546],
  KZ: [48.0196, 66.9237],
  LA: [19.8563, 102.4955],
  LB: [33.8547, 35.8623],
  LC: [13.9094, -60.9789],
  LI: [47.166, 9.5554],
  LK: [7.8731, 80.7718],
  LR: [6.4281, -9.4295],
  LS: [-29.61, 28.2336],
  LT: [55.1694, 23.8813],
  LU: [49.8153, 6.1296],
  LV: [56.8796, 24.6032],
  LY: [26.3351, 17.2283],
  MA: [31.7917, -7.0926],
  MC: [43.7384, 7.4246],
  MD: [47.4116, 28.3699],
  ME: [42.7087, 19.3744],
  MF: [18.0708, -63.0501],
  MG: [-18.7669, 46.8691],
  MH: [7.1315, 171.1845],
  MK: [41.6086, 21.7453],
  ML: [17.5707, -3.9962],
  MM: [21.9162, 95.956],
  MN: [46.8625, 103.8467],
  MO: [22.1987, 113.5439],
  MP: [17.3308, 145.3847],
  MQ: [14.6415, -61.0242],
  MR: [21.0079, -10.9408],
  MS: [16.7425, -62.1874],
  MT: [35.9375, 14.3754],
  MU: [-20.3484, 57.5522],
  MV: [3.2028, 73.2207],
  MW: [-13.2543, 34.3015],
  MX: [23.6345, -102.5528],
  MY: [4.2105, 101.9758],
  MZ: [-18.6657, 35.5296],
  NA: [-22.9576, 18.4904],
  NC: [-20.9043, 165.618],
  NE: [17.6078, 8.0817],
  NF: [-29.0408, 167.9547],
  NG: [9.082, 8.6753],
  NI: [12.8654, -85.2072],
  NL: [52.1326, 5.2913],
  NO: [60.472, 8.4689],
  NP: [28.3949, 84.124],
  NR: [-0.5228, 166.9315],
  NU: [-19.0544, -169.8672],
  NZ: [-40.9006, 174.886],
  OM: [21.4735, 55.9754],
  PA: [8.538, -80.7821],
  PE: [-9.19, -75.0152],
  PF: [-17.6797, -149.4068],
  PG: [-6.315, 143.9555],
  PH: [12.8797, 121.774],
  PK: [30.3753, 69.3451],
  PL: [51.9194, 19.1451],
  PM: [46.8852, -56.3159],
  PR: [18.2208, -66.5901],
  PS: [31.9522, 35.2332],
  PT: [39.3999, -8.2245],
  PW: [7.515, 134.5825],
  PY: [-23.4425, -58.4438],
  QA: [25.3548, 51.1839],
  RE: [-21.1151, 55.5364],
  RO: [45.9432, 24.9668],
  RS: [44.0165, 21.0059],
  RU: [61.524, 105.3188],
  RW: [-1.9403, 29.8739],
  SA: [23.8859, 45.0792],
  SB: [-9.6457, 160.1562],
  SC: [-4.6796, 55.492],
  SD: [12.8628, 30.2176],
  SE: [60.1282, 18.6435],
  SG: [1.3521, 103.8198],
  SH: [-24.1434, -10.0307],
  SI: [46.1512, 14.9955],
  SJ: [77.553, 23.6703],
  SK: [48.669, 19.699],
  SL: [8.4606, -11.7799],
  SM: [43.9424, 12.4578],
  SN: [14.4974, -14.4524],
  SO: [5.1521, 46.1996],
  SR: [3.9193, -56.0278],
  SS: [6.877, 31.307],
  ST: [0.1864, 6.6131],
  SV: [13.7942, -88.8965],
  SX: [18.0347, -63.0681],
  SY: [34.8021, 38.9968],
  SZ: [-26.5225, 31.4659],
  TC: [21.694, -71.7979],
  TD: [15.4542, 18.7322],
  TF: [-49.2804, 69.3486],
  TG: [8.6195, 0.8248],
  TH: [15.87, 100.9925],
  TJ: [38.861, 71.2761],
  TK: [-8.9674, -171.8559],
  TL: [-8.8742, 125.7275],
  TM: [38.9697, 59.5563],
  TN: [33.8869, 9.5375],
  TO: [-21.179, -175.1982],
  TR: [38.9637, 35.2433],
  TT: [10.6918, -61.2225],
  TV: [-7.1095, 177.6493],
  TW: [23.6978, 120.9605],
  TZ: [-6.369, 34.8888],
  UA: [48.3794, 31.1656],
  UG: [1.3733, 32.2903],
  UM: [19.2823, 166.647],
  US: [37.0902, -95.7129],
  UY: [-32.5228, -55.7658],
  UZ: [41.3775, 64.5853],
  VA: [41.9029, 12.4534],
  VC: [12.9843, -61.2872],
  VE: [6.4238, -66.5897],
  VG: [18.4207, -64.64],
  VI: [18.3358, -64.8963],
  VN: [14.0583, 108.2772],
  VU: [-15.3767, 166.9592],
  WF: [-13.7688, -177.1561],
  WS: [-13.759, -172.1046],
  XK: [42.6026, 20.903],
  YE: [15.5527, 48.5164],
  YT: [-12.8275, 45.1662],
  ZA: [-30.5595, 22.9375],
  ZM: [-13.1339, 27.8493],
  ZW: [-19.0154, 29.1549]
};
function countryCentroid(iso2) {
  const c = iso2.toUpperCase();
  return MAP[c] ?? null;
}
__name(countryCentroid, "countryCentroid");
__name2(countryCentroid, "countryCentroid");
var onRequestOptions3 = /* @__PURE__ */ __name2(async () => corsOptions(), "onRequestOptions");
var onRequestGet2 = /* @__PURE__ */ __name2(async ({ env }) => {
  if (!env.VISITOR_KV) {
    return json({ total: 0, markers: [] });
  }
  const agg = await readAgg(env.VISITOR_KV);
  const markers = Object.entries(agg.byCountry).map(([country, count]) => {
    const c = countryCentroid(country);
    if (!c) return null;
    return { lat: c[0], lng: c[1], count, country };
  }).filter((m) => m !== null);
  return json({ total: agg.total, markers });
}, "onRequestGet");
var onRequestOptions4 = /* @__PURE__ */ __name2(async () => corsOptions(), "onRequestOptions");
var onRequestPost2 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  if (!env.VISITOR_KV) {
    return json({ ok: false, error: "VISITOR_KV not configured" }, 503);
  }
  const cf = request.cf;
  const country = cf?.country?.toUpperCase();
  if (!country || country === "XX" || country === "T1") {
    return json({ ok: true, recorded: false });
  }
  const cityRaw = cf?.city;
  const city = typeof cityRaw === "string" && cityRaw.length > 0 && cityRaw.toLowerCase() !== "null" ? cityRaw : void 0;
  const agg = await readAgg(env.VISITOR_KV);
  agg.total += 1;
  agg.byCountry[country] = (agg.byCountry[country] ?? 0) + 1;
  if (city) {
    const ck = `${country}|${city}`;
    const cur = agg.byCityKey[ck];
    if (cur) cur.count += 1;
    else agg.byCityKey[ck] = { country, city, count: 1 };
  }
  await writeAgg(env.VISITOR_KV, agg);
  return json({ ok: true, recorded: true });
}, "onRequestPost");
var routes = [
  {
    routePath: "/api/admin/stats",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/stats",
    mountPath: "/api/admin",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/checkout",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/checkout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/visit",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/visit",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-eVPTon/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-eVPTon/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.03417887227936878.js.map
