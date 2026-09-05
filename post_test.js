(async () => {
  try {
    const res = await fetch('http://localhost:3001/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        date: '2026-09-10',
        service: 'Portrait',
        message: 'hello'
      })
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    try { console.log('JSON:', JSON.parse(text)); } catch { console.log('BODY:', text); }
  } catch (err) {
    console.error('ERROR', err);
  }
})();
