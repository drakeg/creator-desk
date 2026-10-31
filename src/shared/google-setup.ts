export const googleSetupPages = {
  project: {
    label: "Create or select a Google Cloud project",
    url: "https://console.cloud.google.com/projectcreate",
  },
  dataApi: {
    label: "Enable YouTube Data API v3",
    url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  },
  analyticsApi: {
    label: "Enable YouTube Analytics API",
    url: "https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com",
  },
  branding: {
    label: "Configure app branding and contact details",
    url: "https://console.cloud.google.com/auth/branding",
  },
  audience: {
    label: "Add test users or manage the audience",
    url: "https://console.cloud.google.com/auth/audience",
  },
  scopes: {
    label: "Configure read-only data access",
    url: "https://console.cloud.google.com/auth/scopes",
  },
  clients: {
    label: "Create a Desktop app OAuth client",
    url: "https://console.cloud.google.com/auth/clients",
  },
  connections: {
    label: "Manage Google account connections",
    url: "https://myaccount.google.com/connections",
  },
} as const;
export type GoogleSetupPage = keyof typeof googleSetupPages;
export const googleSetupPageIds = Object.keys(
  googleSetupPages,
) as GoogleSetupPage[];
