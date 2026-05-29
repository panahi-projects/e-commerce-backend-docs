# Browsing & Search

How to find products in the catalogue.

## List published products

```bash
curl 'http://localhost:3000/api/v1/products?page=1&limit=20'
```

The response is the standard envelope with `data` (products) and `meta` (pagination). Only products in `published` status are returned.

## Search by text

```bash
curl 'http://localhost:3000/api/v1/products?q=running%20shoes'
```

Search is full-text over `name.en` and `description.en`.

## Filter

| Query parameter | What it does                                     |
| --------------- | ------------------------------------------------ |
| `categoryId`    | Show products in one category                    |
| `tags`          | Comma-separated tag list — products matching any |
| `minPrice`      | Lower bound on the product's `basePrice`         |
| `maxPrice`      | Upper bound                                      |
| `isFeatured`    | `true` returns featured products only            |
| `sort`          | e.g. `-createdAt`, `basePrice`, `-averageRating` |

Example:

```bash
curl 'http://localhost:3000/api/v1/products?categoryId=655e...&minPrice=20&maxPrice=80&sort=-averageRating'
```

## One product by slug or id

```bash
curl http://localhost:3000/api/v1/products/655ec1...

# or by slug
curl http://localhost:3000/api/v1/products/slug/red-running-shoes
```

## Categories

```bash
# Flat list
curl http://localhost:3000/api/v1/categories

# Tree (parent → children recursively)
curl http://localhost:3000/api/v1/categories/tree
```

## Variants

Each product carries an array of variants. A variant has its own `sku`, `price`, `stock`, and `attributes` (size, colour, etc.). Always pass the variant `sku` (not the product id alone) when adding to cart.

## FAQ

**A product shows as out of stock but it has variants in stock — why?**
The product list aggregates across all variants. A specific variant may be in stock even if the headline product is "low stock". Open the product detail page to see per-variant availability.

**How do I get only products from one tenant?**
Tenant routing is automatic via the subdomain or `X-Tenant-ID` header — the products endpoint returns this tenant's catalogue.

**What language is the response in?**
The `name` and `description` fields are localized — they contain `{ en, fa }`. Use the `Accept-Language` header to influence which fields the server emphasises in any future per-locale endpoints.
