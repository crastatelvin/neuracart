# NeuraCart — System Architecture

> The authoritative specification is [`plan.md`](./plan.md). This diagram was extracted from the original design images (where the product was called LocalCart) and is kept as an architecture reference.

Extracted from the architecture diagram.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 460, "nodeSpacing": 35, "rankSpacing": 45, "padding": 12}, "themeVariables": {"fontSize": "15px"}}}%%
flowchart TB

  subgraph CLIENTS[" "]
    direction LR

    subgraph CA[" "]
      direction TB
      ca1["<b>Customer App</b><br/><i>Expo + NativeWind</i>"]
      ca2["Auth (OTP login)<br/>Home + search<br/>Product catalog<br/>Cart + checkout<br/>Order tracking<br/>Address mgmt<br/>Profile"]
      ca3["Zustand state<br/>AsyncStorage tokens"]
      ca1 ~~~ ca2 ~~~ ca3
      style ca1 fill:#C8E6C9,stroke:#2E7D32,color:#1B5E20
      style ca2 fill:#E8F5E9,stroke:#66BB6A,color:#1B5E20
      style ca3 fill:#E8F5E9,stroke:#66BB6A,color:#1B5E20
      style CA fill:#F1FAF2,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    end

    subgraph AP[" "]
      direction TB
      ap1["<b>Admin Panel</b><br/><i>Next.js + Tailwind CSS</i>"]
      ap2["OTP login<br/>Dashboard stats<br/>Order management<br/>Assign delivery partner<br/>Product CRUD<br/>Image uploads<br/>Partner management"]
      ap3["Axios + interceptor<br/>Auto token refresh"]
      ap1 ~~~ ap2 ~~~ ap3
      style ap1 fill:#D1C4E9,stroke:#5E35B1,color:#311B92
      style ap2 fill:#EDE7F6,stroke:#9575CD,color:#311B92
      style ap3 fill:#EDE7F6,stroke:#9575CD,color:#311B92
      style AP fill:#F8F5FD,stroke:#5E35B1,stroke-width:2px,color:#311B92
    end

    subgraph DA[" "]
      direction TB
      da1["<b>Delivery App</b><br/><i>Expo + NativeWind</i>"]
      da2["Password login<br/>Active orders tab<br/>Completed orders<br/>Start delivery<br/>Mark delivered<br/>Google Maps nav<br/>Call customer"]
      da3["Zustand state<br/>AsyncStorage tokens"]
      da1 ~~~ da2 ~~~ da3
      style da1 fill:#FFCC80,stroke:#EF6C00,color:#E65100
      style da2 fill:#FFF3E0,stroke:#FFB74D,color:#E65100
      style da3 fill:#FFF3E0,stroke:#FFB74D,color:#E65100
      style DA fill:#FFFAF2,stroke:#EF6C00,stroke-width:2px,color:#E65100
    end

    CA ~~~ AP ~~~ DA
    style CLIENTS fill:none,stroke:none
  end

  CLIENTS -->|"REST API — JWT Bearer token"| BACKEND

  subgraph BACKEND["<b>Backend — Node.js + Express + TypeScript</b><br/>Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL"]
    direction TB

    subgraph MW["Middleware"]
      direction LR
      mw1["<b>Auth middleware</b><br/>JWT verify<br/>Role guard"]
      mw2["<b>Rate limiter</b><br/>OTP: 5/15min<br/>Global: 100/15min"]
      mw3["<b>Validation</b><br/>Zod schemas<br/>422 on fail"]
      mw4["<b>Security</b><br/>Helmet + CORS<br/>Multer uploads"]
      mw1 ~~~ mw2 ~~~ mw3 ~~~ mw4
      style mw1 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
      style mw2 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
      style mw3 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
      style mw4 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
      style MW fill:#FFF5F5,stroke:#E53935,color:#B71C1C
    end

    subgraph AM["— API Modules —"]
      direction LR
      am1["<b>Auth</b><br/>OTP · JWT<br/>refresh · logout"]
      am2["<b>Products</b><br/>CRUD · images<br/>stock · category"]
      am3["<b>Orders</b><br/>place · status<br/>assign · track"]
      am4["<b>Address</b><br/>CRUD · default<br/>lat/lng"]
      am5["<b>Delivery</b><br/>partners · avail<br/>location · verify"]
      am1 ~~~ am2 ~~~ am3 ~~~ am4 ~~~ am5
      style am1 fill:#BBDEFB,stroke:#1E88E5,color:#0D47A1
      style am2 fill:#BBDEFB,stroke:#1E88E5,color:#0D47A1
      style am3 fill:#BBDEFB,stroke:#1E88E5,color:#0D47A1
      style am4 fill:#BBDEFB,stroke:#1E88E5,color:#0D47A1
      style am5 fill:#BBDEFB,stroke:#1E88E5,color:#0D47A1
      style AM fill:#F5FAFF,stroke:#1E88E5,color:#0D47A1
    end

    subgraph UT["— Utilities —"]
      direction LR
      ut1["<b>Logger</b><br/>File + console logs"]
      ut2["<b>JWT utils</b><br/>access + refresh"]
      ut3["<b>OTP utils</b><br/>generate + expiry"]
      ut4["<b>Response helpers</b><br/>success + paginated"]
      ut1 ~~~ ut2 ~~~ ut3 ~~~ ut4
      style ut1 fill:#C8E6C9,stroke:#43A047,color:#1B5E20
      style ut2 fill:#C8E6C9,stroke:#43A047,color:#1B5E20
      style ut3 fill:#C8E6C9,stroke:#43A047,color:#1B5E20
      style ut4 fill:#C8E6C9,stroke:#43A047,color:#1B5E20
      style UT fill:#F6FCF6,stroke:#43A047,color:#1B5E20
    end

    subgraph INF[" "]
      direction LR
      in1["<b>Prisma ORM</b><br/>type-safe queries · migrations"]
      in2["<b>Resend</b><br/>OTP + order emails"]
      in3["<b>Multer + Sharp</b><br/>image upload + processing"]
      in1 ~~~ in2 ~~~ in3
      style in1 fill:#B2EBF2,stroke:#00ACC1,color:#006064
      style in2 fill:#F8BBD0,stroke:#EC407A,color:#880E4F
      style in3 fill:#FFE0B2,stroke:#FB8C00,color:#E65100
      style INF fill:none,stroke:none
    end

    MW ~~~ AM ~~~ UT ~~~ INF
    style BACKEND fill:#F1F8EC,stroke:#66BB6A,stroke-width:2px,color:#1B5E20
  end

  PG["<b>PostgreSQL — 11 tables</b><br/><br/>users · products · orders<br/>otp_codes · refresh_tokens · order_items<br/>addresses · delivery_partners · order_status_history<br/>order_tracking · store"]
  style PG fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20

  BACKEND --> PG
```

---

## PostgreSQL — 11 tables

| Row 1 | Row 2 | Row 3 |
|---|---|---|
| `users` | `products` | `orders` |
| `otp_codes` | `refresh_tokens` | `order_items` |
| `addresses` | `delivery_partners` | `order_status_history` |
| `order_tracking` | `store` | |

## Legend

| Colour | Meaning |
|---|---|
| Green | Customer App |
| Purple | Admin Panel |
| Orange | Delivery App |
| Red | Middleware |
| Blue | API modules |