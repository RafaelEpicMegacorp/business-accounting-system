# 🧭 Wise Sandbox API -- Transaction Retrieval Instructions

## Overview

This guide shows how to use the Wise Sandbox API to retrieve a specific
transfer's details using a transaction (transfer) ID.

------------------------------------------------------------------------

## 1️⃣ Prerequisites

Before running the code, make sure you have:

-   **Node.js** installed on your computer\
    → Download from <https://nodejs.org>
-   A **Wise Sandbox API token**\
    → You can generate it from: <https://sandbox.transferwise.tech>
-   A **transfer ID** (e.g., `55576213`) to query

------------------------------------------------------------------------

## 2️⃣ Install Dependencies

Create a new folder and open it in a terminal, then run:

``` bash
npm init -y
npm install axios
```

------------------------------------------------------------------------

## 3️⃣ Create a JavaScript File

Create a file named **`wise-transfer.js`** and paste this code:

``` javascript
const axios = require('axios');

let config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://api.sandbox.transferwise.tech/v1/transfers/55576213', // Replace with your transfer ID
  headers: { 
    'Authorization': 'Bearer YOUR_SANDBOX_API_TOKEN' // Replace with your API token
  }
};

axios.request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch((error) => {
    console.error(error.response?.data || error.message);
  });
```

------------------------------------------------------------------------

## 4️⃣ Replace with Your Details

In the file: - Replace `55576213` with your **transfer ID** - Replace
`YOUR_SANDBOX_API_TOKEN` with your **Wise Sandbox token**

------------------------------------------------------------------------

## 5️⃣ Run the Script

Run it in your terminal using:

``` bash
node wise-transfer.js
```

If everything is set correctly, you'll see the **JSON response**
containing the transfer details:

``` json
{
  "id": 55576213,
  "user": 12345,
  "targetAccount": 67890,
  "amount": 100,
  "currency": "EUR",
  ...
}
```

------------------------------------------------------------------------

## 6️⃣ Troubleshooting

  -----------------------------------------------------------------------
  Issue                    Cause                        Fix
  ------------------------ ---------------------------- -----------------
  `401 Unauthorized`       Invalid or expired token     Generate a new
                                                        API token

  `404 Not Found`          Invalid transfer ID          Double-check the
                                                        ID

  `ENOTFOUND`              Network error                Check internet
                                                        connection or
                                                        Wise API URL
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 7️⃣ Optional: Test in Postman

If you want to test in **Postman** instead of code: 1. Create a new
**GET request**\
`https://api.sandbox.transferwise.tech/v1/transfers/{transferId}` 2. Go
to **Headers** and add:\
`Authorization: Bearer YOUR_SANDBOX_API_TOKEN` 3. Click **Send** →
You'll get the transfer details in the response.
