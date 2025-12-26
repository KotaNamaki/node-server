# Dokumentasi API E-Commerce

Dokumentasi ini menjelaskan endpoint yang tersedia pada server backend, cara autentikasi, dan contoh penggunaan menggunakan Fetch API di sisi frontend.

## Informasi Dasar

* **Base URL:** `http://localhost:3000` (atau domain produksi Anda)
* **Autentikasi:** Session-based (Cookies).
* **Penting:** Semua request dari frontend **wajib** menyertakan `credentials: 'include'` agar cookies sesi terbaca oleh server.

-----

## 1\. Authentication (`/auth`)

| Method | Endpoint | Deskripsi | Body / Params | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Masuk ke sistem | `{ "email": "...", "password": "..." }` | Public |
| `POST` | `/auth/register` | Daftar user baru | `{ "nama": "...", "email": "...", "password": "...", "no_hp": "...", "role": "customer" }` | Public |
| `GET` | `/auth/check-session` | Cek status login | - | Public |
| `POST` | `/auth/logout` | Keluar sesi | - | User |

-----

## 2\. Produk (`/products`)

Endpoint GET mendukung parameter React-Admin: `sort`, `range`, `filter`.

| Method | Endpoint | Deskripsi | Body / Params | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/products` | List semua produk | Query: `?sort=["id","ASC"]&range=[0,9]&filter={"q":"nama"}` | Public |
| `GET` | `/products/:id` | Detail produk | - | Public |
| `POST` | `/products` | Tambah produk | **FormData**: `nama`, `kategori`, `deskripsi`, `harga`, `stok`, `gambar` (File) | Admin |
| `PATCH` | `/products/:id` | Update produk | **FormData**: (sama seperti POST) | Admin |
| `DELETE` | `/products/:id` | Hapus produk | - | Admin |

-----

## 3\. Keranjang & Order (`/cart` & `/orders`)

Sistem Order menggunakan transaksi database. Stok dikunci saat checkout.

| Method | Endpoint | Deskripsi | Body / Params | Auth |
| :--- | :--- | :--- | :--- | :--- |
| **CART** | | | | |
| `GET` | `/cart` | Lihat isi keranjang | - | User |
| `POST` | `/cart/items` | Tambah item | `{ "id_produk": 1, "qty": 2 }` | User |
| `PATCH` | `/cart/items/:id` | Update qty item | `{ "qty": 5 }` (ID Produk di URL) | User |
| `DELETE` | `/cart/items/:id` | Hapus item | (ID Produk di URL) | User |
| **ORDER** | | | | |
| `POST` | `/orders` | **Checkout** | - (Otomatis ambil dari cart) | User |
| `GET` | `/orders/:id` | Detail pesanan | - | User/Admin |
| `POST` | `/orders/:id/payments` | Bayar pesanan | `{ "method": "QRIS", "amount": 50000 }` | User |
| `GET` | `/orders` | List pesanan (Admin) | Query: React-Admin params | Admin |
| `PATCH` | `/orders/:id` | Update status (Admin) | `{ "status_pesanan": "dikirim" }` | Admin |

-----

## 4\. Users (`/users`)

| Method | Endpoint | Deskripsi | Body / Params | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users/:id` | Get Profile User | - | User |
| `PATCH` | `/users/update/:id` | Update Profile | `{ "nama": "...", "no_hp": "..." }` | User |
| `GET` | `/users` | List All Users | Query: React-Admin params | Admin |
| `DELETE` | `/users/:id` | Hapus User | - | Admin |

-----

## 5\. Layanan Modifikasi (`/layanan`)

| Method | Endpoint | Deskripsi | Body / Params | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/layanan` | List Layanan | Query: React-Admin params | Public |
| `GET` | `/layanan/:id` | Detail Layanan | - | Public |
| `POST` | `/layanan` | Tambah Layanan | `{ "nama_layanan": "...", "estimasi_harga": 100000, ... }` | Admin |

-----

## Contoh Penggunaan (Frontend Fetch)

Berikut adalah contoh cara menggunakan `fetch` untuk berbagai operasi. **PENTING:** Selalu gunakan `credentials: 'include'` untuk menangani sesi login.

### 1\. READ (GET Data)

Contoh mengambil data keranjang belanja.

```javascript
const getCart = async () => {
  try {
    const response = await fetch('http://localhost:3000/cart', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // WAJIB: Agar server tahu siapa yang login
    });

    const result = await response.json();
    console.log('Isi Keranjang:', result);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2\. CREATE (POST JSON)

Contoh melakukan login atau checkout.

```javascript
const loginUser = async (email, password) => {
  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Simpan cookie sesi setelah login sukses
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    if (response.ok) {
      alert('Login Berhasil!');
    } else {
      alert('Gagal: ' + result.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 3\. CREATE/UPDATE (Multipart/Form-Data)

Khusus untuk **Produk** yang membutuhkan upload gambar, jangan gunakan `Content-Type: application/json`. Gunakan `FormData`.

```javascript
const addProduct = async (fileInput, productData) => {
  const formData = new FormData();
  
  // Append data text
  formData.append('nama', productData.nama);
  formData.append('harga', productData.harga);
  formData.append('stok', productData.stok);
  formData.append('kategori', productData.kategori);
  formData.append('deskripsi', productData.deskripsi);

  // Append files (bisa multiple karena upload.array('gambar', 5))
  for (let i = 0; i < fileInput.files.length; i++) {
    formData.append('gambar', fileInput.files[i]);
  }

  try {
    const response = await fetch('http://localhost:3000/products', {
      method: 'POST',
      credentials: 'include',
      // JANGAN set Content-Type header secara manual saat pakai FormData!
      body: formData 
    });

    const result = await response.json();
    console.log('Produk tersimpan:', result);
  } catch (error) {
    console.error('Upload gagal:', error);
  }
};
```

### 4\. UPDATE (PATCH JSON)

Contoh mengubah jumlah item di keranjang.

```javascript
const updateCartItem = async (productId, newQty) => {
  try {
    const response = await fetch(`http://localhost:3000/cart/items/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ qty: newQty })
    });

    if (response.ok) {
      console.log('Qty berhasil diubah');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 5\. DELETE

Contoh menghapus item dari keranjang.

```javascript
const deleteCartItem = async (productId) => {
  try {
    const response = await fetch(`http://localhost:3000/cart/items/${productId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      console.log('Item dihapus');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Catatan React-Admin

Jika Anda membangun dashboard admin menggunakan React-Admin, endpoint `GET` (List) sudah dikonfigurasi untuk menerima parameter query berikut:

* `filter`: JSON String (contoh: `{"q": "helm"}`)
* `range`: JSON String (contoh: `[0, 9]` untuk pagination)
* `sort`: JSON String (contoh: `["id", "DESC"]`)

Respon akan menyertakan header `Content-Range` yang dibutuhkan React-Admin (contoh: `products 0-9/50`).