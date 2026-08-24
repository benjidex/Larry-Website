const statusEl = document.getElementById('status');
const uploadForm = document.getElementById('uploadForm');
const galleryList = document.getElementById('galleryList');
const logoutBtn = document.getElementById('logoutBtn');

const allowedAdminEmails = () => {
  const list = Array.isArray(window.__APP_CONFIG__?.adminEmails) ? window.__APP_CONFIG__.adminEmails : [];
  return list.map((email) => email.trim().toLowerCase()).filter(Boolean);
};

const supabaseUrl = () => window.__APP_CONFIG__?.supabaseUrl || '';
const supabaseAnonKey = () => window.__APP_CONFIG__?.supabaseAnonKey || '';
const bucketName = () => window.__APP_CONFIG__?.storageBucket || 'portfolio-images';

const supabase = window.supabase.createClient(supabaseUrl(), supabaseAnonKey(), {
  auth: { persistSession: true }
});

async function ensureAuthorizedAdmin() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.href = 'login.html';
    return false;
  }

  const email = sessionData.session.user?.email?.trim().toLowerCase();

  if (!email || !allowedAdminEmails().includes(email)) {
    await supabase.auth.signOut();
    window.location.href = 'login.html?error=not-authorized';
    return false;
  }

  return true;
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#f87171' : '#bcf7d0';
}

async function loadGallery() {
  if (!galleryList) return;

  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    galleryList.innerHTML = '<p>Unable to load gallery right now.</p>';
    return;
  }

  if (!data.length) {
    galleryList.innerHTML = '<p>No images yet. Upload your first photo.</p>';
    return;
  }

  galleryList.innerHTML = data.map((item) => `
    <div class="image-card">
      <img src="${item.image_url}" alt="${item.title || item.category}" />
      <div class="image-info">
        <strong>${item.title || 'Gallery image'}</strong>
        <div class="meta">
          <span>${item.category}</span>
          <button class="danger delete-btn" data-id="${item.id}" data-path="${item.storage_path}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  galleryList.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const storagePath = button.dataset.path;

      try {
        setStatus('Deleting image...');

        const { error: storageError } = await supabase.storage
          .from(bucketName())
          .remove([storagePath]);

        if (storageError) throw storageError;

        const { error: dbError } = await supabase
          .from('gallery_images')
          .delete()
          .eq('id', id);

        if (dbError) throw dbError;

        setStatus('Image deleted successfully.');
        await loadGallery();
      } catch (error) {
        setStatus(error.message || 'Delete failed.', true);
      }
    });
  });
}

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(uploadForm);
  const file = formData.get('image');
  const title = formData.get('title')?.toString().trim();
  const category = formData.get('category')?.toString();

  if (!file || !title || !category) {
    setStatus('Please complete the form before uploading.', true);
    return;
  }

  try {
    setStatus('Uploading image...');

    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName())
      .upload(`gallery/${safeName}`, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(bucketName())
      .getPublicUrl(uploadData.path);

    const { error: insertError } = await supabase.from('gallery_images').insert([{ 
      title,
      category,
      image_url: publicUrlData.publicUrl,
      storage_path: uploadData.path,
      is_active: true,
      sort_order: 0
    }]);

    if (insertError) throw insertError;

    uploadForm.reset();
    setStatus('Image uploaded successfully.');
    await loadGallery();
  } catch (error) {
    setStatus(error.message || 'Upload failed.', true);
  }
});

logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

(async () => {
  const isAuthorized = await ensureAuthorizedAdmin();
  if (!isAuthorized) return;

  await loadGallery();
})();
