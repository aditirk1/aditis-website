import { onRequestGet as __api_admin_stats_ts_onRequestGet } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\admin\\stats.ts"
import { onRequestOptions as __api_admin_stats_ts_onRequestOptions } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\admin\\stats.ts"
import { onRequestOptions as __api_checkout_ts_onRequestOptions } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\checkout.ts"
import { onRequestPost as __api_checkout_ts_onRequestPost } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\checkout.ts"
import { onRequestGet as __api_stats_ts_onRequestGet } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\stats.ts"
import { onRequestOptions as __api_stats_ts_onRequestOptions } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\stats.ts"
import { onRequestOptions as __api_visit_ts_onRequestOptions } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\visit.ts"
import { onRequestPost as __api_visit_ts_onRequestPost } from "C:\\Users\\Aditi\\aditis-website\\functions\\api\\visit.ts"

export const routes = [
    {
      routePath: "/api/admin/stats",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_stats_ts_onRequestGet],
    },
  {
      routePath: "/api/admin/stats",
      mountPath: "/api/admin",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_admin_stats_ts_onRequestOptions],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_checkout_ts_onRequestOptions],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_checkout_ts_onRequestPost],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stats_ts_onRequestGet],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_stats_ts_onRequestOptions],
    },
  {
      routePath: "/api/visit",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_visit_ts_onRequestOptions],
    },
  {
      routePath: "/api/visit",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_visit_ts_onRequestPost],
    },
  ]