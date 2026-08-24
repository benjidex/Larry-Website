const form = document.getElementById('booking-form');
const messageBox = document.getElementById('form-message');

if (form && messageBox) {
  form.setAttribute('data-booking-ready', 'true');
}

const galleryContainer = document.querySelector('.gallery-grid');
const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const btnClose = document.querySelector('.lightbox-close');
const btnPrev = document.querySelector('.lightbox-prev');
const btnNext = document.querySelector('.lightbox-next');

const fallbackImages = [
  { id: 'fallback-1', category: 'wedding', title: 'Wedding couple portrait', src: 'TO use/Wedding/LAR-0723.jpg' },
  { id: 'fallback-2', category: 'wedding', title: 'Wedding couple portrait', src: 'TO use/Wedding/LAR-3969.jpg' },
  { id: 'fallback-3', category: 'wedding', title: 'Wedding couple portrait', src: 'TO use/Wedding/LAR-7851.jpg' },
  { id: 'fallback-4', category: 'wedding', title: 'Wedding couple portrait', src: 'TO use/Wedding/LAR-9885.jpg' },
  { id: 'fallback-5', category: 'graduation', title: 'Graduation snap shot', src: 'TO use/Graduation/LAR-1215.JPG' },
  { id: 'fallback-6', category: 'graduation', title: 'Graduation snap shot', src: 'TO use/Graduation/LAR-1243.JPG' },
  { id: 'fallback-7', category: 'graduation', title: 'Graduation snap shot', src: 'TO use/Graduation/LAR-1628.JPG' },
  { id: 'fallback-8', category: 'graduation', title: 'Graduation snap shot', src: 'TO use/Graduation/LAR-1675.JPG' },
  { id: 'fallback-9', category: 'maternity', title: 'Maternity portrait', src: 'TO use/Maternity/LAR-0060.JPG' },
  { id: 'fallback-10', category: 'maternity', title: 'Maternity portrait', src: 'TO use/Maternity/LAR-0073.jpg b.jpg' },
  { id: 'fallback-11', category: 'maternity', title: 'Maternity portrait', src: 'TO use/Maternity/LAR-1549.JPG' },
  { id: 'fallback-12', category: 'maternity', title: 'Maternity portrait', src: 'TO use/Maternity/LAR-9936.JPG' },
  { id: 'fallback-13', category: 'family', title: 'Family portrait', src: 'TO use/Family/LAR-5673.JPG' },
  { id: 'fallback-14', category: 'family', title: 'Family portrait', src: 'TO use/Family/LAR-5770.jpg' },
  { id: 'fallback-15', category: 'family', title: 'Family portrait', src: 'TO use/Family/LAR-7978.jpg' },
  { id: 'fallback-16', category: 'family', title: 'Family portrait', src: 'TO use/Family/Screenshot 2026-07-08 202801.png' },
  { id: 'fallback-17', category: 'portrait', title: 'Professional portrait', src: 'TO use/Portrait/Screenshot 2026-07-08 210121.png' },
  { id: 'fallback-18', category: 'portrait', title: 'Professional portrait', src: 'TO use/Portrait/LAR-5271.JPG' },
  { id: 'fallback-19', category: 'portrait', title: 'Professional portrait', src: 'TO use/Portrait/LAR-3613.jpg' },
  { id: 'fallback-20', category: 'portrait', title: 'Professional portrait', src: 'TO use/Portrait/LAR-0759.JPG' },
  { id: 'fallback-21', category: 'fashion', title: 'Fashion', src: 'TO use/Fashion/LAR-2611.JPG' },
  { id: 'fallback-22', category: 'fashion', title: 'Fashion', src: 'TO use/Fashion/LAR-9085.jpg' },
  { id: 'fallback-23', category: 'fashion', title: 'Fashion', src: 'TO use/Fashion/LAR-9214.jpg' },
  { id: 'fallback-24', category: 'fashion', title: 'Fashion', src: 'TO use/Fashion/Screenshot 2026-07-08 210220.png' }
];

let currentGroup = 'wedding';
let currentIndex = 0;
let currentItems = [];
let touchStartX = 0;

function buildFigure(item) {
  const figure = document.createElement('figure');
  figure.className = 'gallery-figure';
  figure.dataset.group = item.category;
  figure.dataset.id = item.id;
  figure.dataset.title = item.title || item.category;
  figure.innerHTML = `
    <img src="${item.src || item.image_url}" alt="${item.title || item.category}" />
    <figcaption>${item.title || item.category}</figcaption>
  `;
  return figure;
}

function renderGallery(items) {
  if (!galleryContainer) return;

  const normalized = (items && items.length ? items : fallbackImages).map((item, index) => ({
    id: item.id || `${item.category}-${index}`,
    category: item.category || 'portrait',
    title: item.title || 'Featured photo',
    src: item.src || item.image_url
  }));

  galleryContainer.innerHTML = '';
  normalized.forEach((item) => galleryContainer.appendChild(buildFigure(item)));
  currentItems = normalized;
  attachGalleryListeners();
  applyFilter(currentGroup);
}

function applyFilter(group) {
  currentGroup = group;
  const figures = Array.from(document.querySelectorAll('.gallery-figure'));
  figures.forEach((figure) => {
    const visible = group === 'all' || figure.dataset.group === group;
    figure.style.display = visible ? '' : 'none';
  });

  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === group);
  });
}

function getVisibleFigures() {
  return Array.from(document.querySelectorAll('.gallery-figure')).filter((figure) => {
    return figure.style.display !== 'none';
  });
}

function openLightbox(index, group = currentGroup) {
  if (!lightbox || !lightboxImage || !lightboxCaption) return;
  applyFilter(group);
  const visibleFigures = getVisibleFigures();
  if (!visibleFigures.length) return;
  const safeIndex = ((index % visibleFigures.length) + visibleFigures.length) % visibleFigures.length;
  const figure = visibleFigures[safeIndex];
  const img = figure.querySelector('img');
  lightboxImage.src = img.src;
  lightboxImage.alt = img.alt || figure.dataset.title || 'Featured photo';
  lightboxCaption.textContent = `${figure.dataset.group?.charAt(0).toUpperCase() + figure.dataset.group?.slice(1) || 'Featured'} — ${figure.dataset.title || 'Gallery image'}`;
  lightbox.setAttribute('aria-hidden', 'false');
  currentIndex = safeIndex;
}

function closeLightbox() {
  if (!lightbox || !lightboxImage) return;
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
}

function showPrev() {
  const visibleFigures = getVisibleFigures();
  if (!visibleFigures.length) return;
  const previous = (currentIndex - 1 + visibleFigures.length) % visibleFigures.length;
  openLightbox(previous, currentGroup);
}

function showNext() {
  const visibleFigures = getVisibleFigures();
  if (!visibleFigures.length) return;
  const next = (currentIndex + 1) % visibleFigures.length;
  openLightbox(next, currentGroup);
}

function attachGalleryListeners() {
  const figures = Array.from(document.querySelectorAll('.gallery-figure'));

  figures.forEach((figure) => {
    figure.onclick = () => {
      const visibleFigures = getVisibleFigures();
      const group = figure.dataset.group || currentGroup;
      const index = visibleFigures.indexOf(figure);
      openLightbox(index >= 0 ? index : 0, group);
    };
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const group = button.dataset.filter;
    if (!group) return;
    applyFilter(group);
  });
});

if (btnClose) btnClose.addEventListener('click', closeLightbox);
if (btnPrev) btnPrev.addEventListener('click', (event) => { event.stopPropagation(); showPrev(); });
if (btnNext) btnNext.addEventListener('click', (event) => { event.stopPropagation(); showNext(); });

if (lightbox) {
  lightbox.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
  });

  lightbox.addEventListener('touchend', (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const distance = touchEndX - touchStartX;
    if (Math.abs(distance) > 50) {
      if (distance < 0) showNext();
      else showPrev();
    }
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target === lightboxImage) closeLightbox();
  });
}

document.addEventListener('keydown', (event) => {
  if (!lightbox || lightbox.getAttribute('aria-hidden') !== 'false') return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') showPrev();
  if (event.key === 'ArrowRight') showNext();
});

async function loadPortfolioFromSupabase() {
  const url = window.__APP_CONFIG__?.supabaseUrl || '';
  const key = window.__APP_CONFIG__?.supabaseAnonKey || '';

  if (!url || !key || !window.supabase) {
    renderGallery(fallbackImages);
    return;
  }

  try {
    const supabase = window.supabase.createClient(url, key, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || !data.length) {
      renderGallery(fallbackImages);
      return;
    }

    renderGallery(data.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title || item.category,
      src: item.image_url
    })));
  } catch (error) {
    console.error('Gallery load failed:', error);
    renderGallery(fallbackImages);
  }
}

loadPortfolioFromSupabase();
