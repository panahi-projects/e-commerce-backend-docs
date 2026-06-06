import { defineConfig } from "vitepress";

export default defineConfig({
  title: "E-Commerce Platform Docs",
  description:
    "Customer, Admin, Developer, and Frontend documentation for the multi-tenant e-commerce backend",
  base: "/e-commerce-backend-docs/",
  cleanUrls: true,
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: "User Guide", link: "/guide/" },
      { text: "Admin Guide", link: "/admin/" },
      { text: "Developer", link: "/developer/" },
      { text: "Frontend", link: "/frontend/" },
      { text: "Deployment", link: "/deployment/" },
      { text: "Cheatsheet", link: "/cheatsheet" },
      {
        text: "API (Swagger)",
        link: "https://ecommerce.panahi-projects.ir/api/v1/docs",
        target: "_blank",
      },
      {
        text: "API (Labs)",
        link: "https://ecommerce.panahi-projects.ir/api/v1/reference",
        target: "_blank",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Storefront",
          items: [
            { text: "Getting Started", link: "/guide/" },
            { text: "Authentication", link: "/guide/authentication" },
            { text: "Browsing & Search", link: "/guide/browsing" },
            { text: "Cart", link: "/guide/cart" },
            { text: "Checkout", link: "/guide/checkout" },
            { text: "Orders", link: "/guide/orders" },
            { text: "My Profile", link: "/guide/profile" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Coupons", link: "/guide/plugins/coupons" },
            { text: "Reviews", link: "/guide/plugins/reviews" },
            { text: "Wishlist", link: "/guide/plugins/wishlist" },
            { text: "Compare Products", link: "/guide/plugins/compare" },
            { text: "Loyalty Points", link: "/guide/plugins/loyalty-points" },
          ],
        },
      ],

      "/admin/": [
        {
          text: "Operations",
          items: [
            { text: "Overview", link: "/admin/" },
            { text: "Dashboard", link: "/admin/dashboard" },
            { text: "Products", link: "/admin/products" },
            { text: "Categories", link: "/admin/categories" },
            { text: "Orders", link: "/admin/orders" },
            { text: "Customers", link: "/admin/customers" },
          ],
        },
        {
          text: "Multi-Tenant Control",
          items: [
            { text: "Tenants", link: "/admin/tenants" },
            { text: "Plugins", link: "/admin/plugins" },
            { text: "Feature Flags", link: "/admin/feature-flags" },
          ],
        },
        {
          text: "Plugin Management",
          items: [
            { text: "Coupons", link: "/admin/plugins/coupons" },
            { text: "Reviews", link: "/admin/plugins/reviews" },
            { text: "Marketing", link: "/admin/plugins/marketing" },
            { text: "Analytics", link: "/admin/plugins/analytics" },
            { text: "Loyalty Points", link: "/admin/plugins/loyalty-points" },
          ],
        },
      ],

      "/developer/": [
        {
          text: "Getting Started",
          items: [
            { text: "Overview", link: "/developer/" },
            { text: "Setup", link: "/developer/setup" },
            { text: "Architecture", link: "/developer/architecture" },
            { text: "API Reference", link: "/developer/api-reference" },
            { text: "Deployment", link: "/developer/deployment" },
          ],
        },
        {
          text: "Cross-Cutting",
          items: [
            { text: "Auth Flow", link: "/developer/auth-flow" },
            { text: "Authorization (RBAC)", link: "/developer/authorization" },
            { text: "Database", link: "/developer/database" },
            { text: "Testing", link: "/developer/testing" },
            { text: "i18n", link: "/developer/i18n" },
            { text: "Error Handling", link: "/developer/error-handling" },
            { text: "Security", link: "/developer/security" },
            { text: "Payments", link: "/developer/payments" },
            { text: "SMS", link: "/developer/sms" },
            { text: "Events", link: "/developer/events" },
          ],
        },
        {
          text: "Plugin System",
          items: [
            { text: "Overview", link: "/developer/plugins/overview" },
            {
              text: "Creating a Plugin",
              link: "/developer/plugins/creating-a-plugin",
            },
            {
              text: "Feature Flags API",
              link: "/developer/plugins/feature-flags",
            },
            {
              text: "Plugin Registry",
              link: "/developer/plugins/plugin-registry",
            },
            {
              text: "Existing Plugins",
              collapsed: true,
              items: [
                {
                  text: "Coupons",
                  link: "/developer/plugins/existing-plugins/coupons",
                },
                {
                  text: "Reviews",
                  link: "/developer/plugins/existing-plugins/reviews",
                },
                {
                  text: "Compare Products",
                  link: "/developer/plugins/existing-plugins/compare-products",
                },
                {
                  text: "Wishlist",
                  link: "/developer/plugins/existing-plugins/wishlist",
                },
                {
                  text: "Marketing",
                  link: "/developer/plugins/existing-plugins/marketing",
                },
                {
                  text: "Analytics",
                  link: "/developer/plugins/existing-plugins/analytics",
                },
                {
                  text: "Loyalty Points",
                  link: "/developer/plugins/existing-plugins/loyalty-points",
                },
                {
                  text: "Notifications",
                  link: "/developer/plugins/existing-plugins/notifications",
                },
              ],
            },
          ],
        },
      ],

      "/frontend/": [
        {
          text: "Frontend Integration",
          items: [
            { text: "Overview", link: "/frontend/" },
            { text: "Connecting to the API", link: "/frontend/connecting" },
            { text: "Authentication", link: "/frontend/authentication" },
            { text: "Multi-Tenant", link: "/frontend/multi-tenant" },
            { text: "Generating an API Client", link: "/frontend/api-client" },
          ],
        },
      ],

      "/deployment/": [
        {
          text: "Start Here",
          items: [
            { text: "Overview", link: "/deployment/" },
            { text: "Prerequisites", link: "/deployment/prerequisites" },
          ],
        },
        {
          text: "Linux VPS",
          items: [
            {
              text: "Generic Ubuntu/Debian VPS",
              link: "/deployment/ubuntu-debian-vps",
            },
            { text: "ArvanCloud (Iran)", link: "/deployment/arvancloud" },
            { text: "Liara (Iran)", link: "/deployment/liara" },
          ],
        },
        {
          text: "Cloud Providers",
          items: [
            { text: "AWS EC2", link: "/deployment/aws-ec2" },
            { text: "DigitalOcean Droplet", link: "/deployment/digitalocean" },
          ],
        },
        {
          text: "Portable",
          items: [
            {
              text: "Docker Compose (any host)",
              link: "/deployment/docker-compose",
            },
            {
              text: "Windows Server / Docker Desktop",
              link: "/deployment/windows-server",
            },
          ],
        },
      ],
    },

    search: { provider: "local" },
    socialLinks: [],
    outline: { level: [2, 3] },

    footer: {
      message:
        'Written by <a href="http://panahi-projects.ir" target="_blank" rel="noopener">Saeed Panahi</a> &middot; <a href="mailto:panahi.projects@gmail.com">panahi.projects@gmail.com</a>',
      copyright: "Copyright © 2026 Saeed Panahi",
    },
  },
});
