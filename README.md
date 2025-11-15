# Dokumentasi API 

## Informasi Umum

**Base URL:** `http://localhost:3000/api`

**Content-Type:** `application/json`

**Autentikasi:** Session-based (Cookie)

> ⚠️ **PENTING:** Setelah login, server mengirim `Set-Cookie: sessionId` dengan flag `HttpOnly`. Semua request selanjutnya **WAJIB** menyertakan `credentials: 'include'` agar cookie session terkirim.

```javascript
fetch('http://localhost:3000/api/cart', {
  method: 'GET',
  credentials: 'include' // <-- WAJIB ADA UNTUK SEMUA REQUEST
});
```

---

## /api/auth

### POST /api/auth/register

**Deskripsi:** Mendaftarkan user baru

**Auth:** Publik

**Request Body:**
```json
{
  "nama": "Budi Customer",
  "email": "budi@gmail.com",
  "password": "123",
  "no_hp": "08123",
  "role": "customer"
}
```

---

### POST /api/auth/login

**Deskripsi:** Login dan membuat session

**Auth:** Publik

**Request Body:**
```json
{
  "email": "budi@gmail.com",
  "password": "123"
}
```

**Response:**
```json
{
  "message": "Logged in successfully!",
  "user": {
    "userId": 1,
    "email": "budi@gmail.com",
    "role": "customer"
  }
}
```

> Server akan mengirim `Set-Cookie: sessionId` dengan flag `HttpOnly`

---

### POST /api/auth/logout

**Deskripsi:** Logout dan menghancurkan session

**Auth:** Wajib Login

**Response:**
```json
{
  "message": "Logout berhasil."
}
```

---

## /api/products

### GET /api/products/search

**Deskripsi:** Mendapatkan semua produk

**Auth:** Publik

---

### GET /api/products/search/:id

**Deskripsi:** Mendapatkan detail produk berdasarkan ID

**Auth:** Publik

**Parameter:**
- `:id` - ID produk

---

### POST /api/products

**Deskripsi:** Menambah produk baru

**Auth:** Admin

**Request Body:**
```json
{
  "nama": "Produk Baru",
  "kategori": "Elektronik",
  "deskripsi": "Deskripsi produk...",
  "harga": 500000,
  "stok": 10
}
```

---

### PATCH /api/products/:id

**Deskripsi:** Memperbarui produk

**Auth:** Admin

**Parameter:**
- `:id` - ID produk

**Request Body:**
```json
{
  "nama": "Nama Produk Update",
  "harga": 550000
}
```

---

### DELETE /api/products/:id

**Deskripsi:** Menghapus produk

**Auth:** Admin

**Parameter:**
- `:id` - ID produk

---

## /api/users

### GET /api/users

**Deskripsi:** Mendapatkan semua user

**Auth:** Wajib Login (Admin)

---

### GET /api/users/:id

**Deskripsi:** Mendapatkan detail user berdasarkan ID

**Auth:** Wajib Login

**Parameter:**
- `:id` - ID user

---

### PATCH /api/users/update/:id

**Deskripsi:** Memperbarui data user

**Auth:** Wajib Login
- **Admin:** Bisa update user mana saja
- **Customer:** Hanya bisa update data sendiri

**Parameter:**
- `:id` - ID user

**Request Body:**
```json
{
  "nama": "Nama Baru Saya",
  "password": "passwordBaru123"
}
```

---

## /api/cart

### GET /api/cart

**Deskripsi:** Melihat isi keranjang

**Auth:** Wajib Login

---

### POST /api/cart/items

**Deskripsi:** Menambah atau memperbarui item ke keranjang

**Auth:** Wajib Login

**Request Body:**
```json
{
  "id_produk": 1,
  "qty": 2
}
```

---

### PATCH /api/cart/items/:productId

**Deskripsi:** Mengubah jumlah item di keranjang

**Auth:** Wajib Login

**Parameter:**
- `:productId` - ID produk

**Request Body:**
```json
{
  "qty": 5
}
```

---

### DELETE /api/cart/items/:productId

**Deskripsi:** Menghapus item dari keranjang

**Auth:** Wajib Login

**Parameter:**
- `:productId` - ID produk

---

## /api/orders

### POST /api/orders

**Deskripsi:** Checkout keranjang menjadi pesanan baru

**Auth:** Wajib Login

**Response:**
```json
{
  "message": "Pesanan dibuat.",
  "id_pesanan": 12,
  "total_harga": 150000,
  "status": "pending"
}
```

---

### GET /api/orders/get/:id

**Deskripsi:** Melihat detail pesanan

**Auth:** Wajib Login

**Parameter:**
- `:id` - ID pesanan

---

### POST /api/orders/:id/payments

**Deskripsi:** Melakukan pembayaran untuk pesanan

**Auth:** Wajib Login

**Syarat:** Status pesanan harus `pending`

**Parameter:**
- `:id` - ID pesanan

**Request Body:**
```json
{
  "method": "QRIS",
  "amount": 150000
}
```

**Response:**
```json
{
  "message": "Pembayaran berhasil.",
  "id_pembayaran": 5,
  "id_pesanan": 12,
  "status": "diproses"
}
```

---

## Contoh Penggunaan di Frontend

### 1. Registrasi User

```javascript
async function registerUser() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        nama: 'Budi Customer',
        email: 'budi@gmail.com',
        password: '123',
        no_hp: '08123456789',
        role: 'customer'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Registrasi berhasil:', data);
      window.location.href = '/login';
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 2. Login User

```javascript
async function loginUser() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Penting!
      body: JSON.stringify({
        email: 'budi@gmail.com',
        password: '123'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      // Server otomatis set cookie sessionId
      console.log('Login berhasil:', data);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } else {
      alert('Email atau password salah');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 3. Logout User

```javascript
async function logoutUser() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(data.message);
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 4. Menampilkan Daftar Produk

```javascript
async function loadProducts() {
  try {
    const response = await fetch('http://localhost:3000/api/products/search', {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();
    
    if (response.ok) {
      displayProducts(data.products);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayProducts(products) {
  const container = document.getElementById('product-list');
  container.innerHTML = products.map(product => `
    <div class="product-card">
      <h3>${product.nama}</h3>
      <p>${product.deskripsi}</p>
      <p>Kategori: ${product.kategori}</p>
      <p>Harga: Rp ${product.harga.toLocaleString()}</p>
      <p>Stok: ${product.stok}</p>
      <button onclick="addToCart(${product.id}, 1)">Tambah ke Keranjang</button>
    </div>
  `).join('');
}
```

---

### 5. Menambahkan Produk ke Keranjang

```javascript
async function addToCart(productId, quantity) {
  try {
    const response = await fetch('http://localhost:3000/api/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        id_produk: productId,
        qty: quantity
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      alert('Produk berhasil ditambahkan ke keranjang!');
      updateCartBadge();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 6. Melihat Isi Keranjang

```javascript
async function loadCart() {
  try {
    const response = await fetch('http://localhost:3000/api/cart', {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();
    
    if (response.ok) {
      displayCart(data.items);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayCart(items) {
  const container = document.getElementById('cart-items');
  
  if (items.length === 0) {
    container.innerHTML = '<p>Keranjang kosong</p>';
    return;
  }
  
  const total = items.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  
  container.innerHTML = `
    ${items.map(item => `
      <div class="cart-item">
        <h4>${item.nama_produk}</h4>
        <p>Harga: Rp ${item.harga.toLocaleString()}</p>
        <div>
          <label>Jumlah:</label>
          <input type="number" value="${item.qty}" min="1"
                 onchange="updateCartItem(${item.id_produk}, this.value)">
          <button onclick="removeFromCart(${item.id_produk})">Hapus</button>
        </div>
        <p>Subtotal: Rp ${(item.harga * item.qty).toLocaleString()}</p>
      </div>
    `).join('')}
    <div class="cart-total">
      <h3>Total: Rp ${total.toLocaleString()}</h3>
      <button onclick="checkout()">Checkout</button>
    </div>
  `;
}
```

---

### 7. Update Jumlah Item di Keranjang

```javascript
async function updateCartItem(productId, newQuantity) {
  try {
    const response = await fetch(`http://localhost:3000/api/cart/items/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        qty: parseInt(newQuantity)
      })
    });

    if (response.ok) {
      loadCart(); // Refresh keranjang
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 8. Hapus Item dari Keranjang

```javascript
async function removeFromCart(productId) {
  if (!confirm('Yakin ingin menghapus item ini?')) return;
  
  try {
    const response = await fetch(`http://localhost:3000/api/cart/items/${productId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      loadCart(); // Refresh keranjang
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 9. Checkout (Buat Pesanan)

```javascript
async function checkout() {
  try {
    const response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Pesanan dibuat:', data);
      alert(`Pesanan berhasil dibuat!\nID Pesanan: ${data.id_pesanan}\nTotal: Rp ${data.total_harga.toLocaleString()}\nStatus: ${data.status}`);
      // Redirect ke halaman pembayaran
      window.location.href = `/payment/${data.id_pesanan}`;
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 10. Proses Pembayaran

```javascript
async function processPayment(orderId, paymentMethod, amount) {
  try {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        method: paymentMethod, // 'QRIS', 'Transfer Bank', etc.
        amount: amount
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Pembayaran berhasil:', data);
      alert(`Pembayaran berhasil!\nID Pembayaran: ${data.id_pembayaran}\nStatus Pesanan: ${data.status}`);
      window.location.href = '/orders';
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 11. Menambah Produk Baru (Admin)

```javascript
async function createProduct(formData) {
  try {
    const response = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        nama: formData.nama,
        kategori: formData.kategori,
        deskripsi: formData.deskripsi,
        harga: parseInt(formData.harga),
        stok: parseInt(formData.stok)
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      alert('Produk berhasil ditambahkan!');
      loadProducts(); // Refresh daftar produk
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 12. Update Produk (Admin)

```javascript
async function updateProduct(productId, updateData) {
  try {
    const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    
    if (response.ok) {
      alert('Produk berhasil diupdate!');
      loadProducts();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 13. Hapus Produk (Admin)

```javascript
async function deleteProduct(productId) {
  if (!confirm('Yakin ingin menghapus produk ini?')) return;
  
  try {
    const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      alert('Produk berhasil dihapus!');
      loadProducts();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

### 14. Contoh Form HTML Lengkap

```html
<!-- Form Login -->
<form id="loginForm" onsubmit="handleLogin(event)">
  <h2>Login</h2>
  <input type="email" name="email" placeholder="Email" required>
  <input type="password" name="password" placeholder="Password" required>
  <button type="submit">Login</button>
</form>

<!-- Form Tambah Produk (Admin) -->
<form id="productForm" onsubmit="handleAddProduct(event)">
  <h2>Tambah Produk</h2>
  <input type="text" name="nama" placeholder="Nama Produk" required>
  <input type="text" name="kategori" placeholder="Kategori" required>
  <textarea name="deskripsi" placeholder="Deskripsi" required></textarea>
  <input type="number" name="harga" placeholder="Harga" required>
  <input type="number" name="stok" placeholder="Stok" required>
  <button type="submit">Tambah Produk</button>
</form>

<script>
async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  await loginUser();
}

async function handleAddProduct(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  await createProduct({
    nama: formData.get('nama'),
    kategori: formData.get('kategori'),
    deskripsi: formData.get('deskripsi'),
    harga: formData.get('harga'),
    stok: formData.get('stok')
  });
  
  event.target.reset();
}
</script>
```

---

## Tips Penting

1. **Selalu gunakan `credentials: 'include'`** pada setiap fetch request
2. **Session Cookie** otomatis dikirim oleh browser setelah login berhasil
3. **HttpOnly Cookie** tidak bisa diakses via JavaScript (lebih aman)
4. **Error Handling** selalu gunakan try-catch untuk menangani error
5. **Response Status** cek `response.ok` sebelum memproses data
6. **CORS** pastikan backend mengizinkan origin frontend Anda

---

## Status Pesanan

- `pending` - Menunggu pembayaran
- `diproses` - Sedang diproses setelah pembayaran
- `dikirim` - Pesanan dalam pengiriman
- `selesai` - Pesanan selesai

---

## Role User

- `customer` - User biasa (bisa belanja)
- `admin` - Administrator (bisa kelola produk dan user)
