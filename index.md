---
layout: home

hero:
  name: E-Commerce Platform
  text: Multi-tenant backend documentation
  tagline: One NestJS codebase, many customers, configurable feature set per tenant.
  actions:
    - theme: brand
      text: User Guide
      link: /guide/
    - theme: alt
      text: Developer Docs
      link: /developer/

features:
  - icon: 👤
    title: User Guide
    details: How customers register, browse, check out, and use plugin features like coupons, wishlist, and loyalty points.
    link: /guide/
    linkText: Open
  - icon: 🛠️
    title: Admin Guide
    details: How operators manage tenants, toggle plugins and feature flags, and run day-to-day operations.
    link: /admin/
    linkText: Open
  - icon: 👨‍💻
    title: Developer Docs
    details: Architecture, setup, plugin system, and per-plugin technical reference.
    link: /developer/
    linkText: Open
  - icon: 🔌
    title: Frontend Integration
    details: How to connect a frontend to the API — auth, multi-tenancy, and generating an API client.
    link: /frontend/
    linkText: Open
---

## What is this project?

A production-grade NestJS 11 + MongoDB REST API sold as a white-label product to multiple tenants. Non-essential features are packaged as **plugins** — loaded conditionally at boot and gated per tenant at runtime via **feature flags**.

The docs are split by audience so each reader gets exactly the depth they need.
