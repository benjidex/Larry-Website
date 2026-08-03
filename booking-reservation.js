(function () {
  const form = document.getElementById('booking-form');
  const messageBox = document.getElementById('form-message');

  if (!form || !messageBox) return;

  const supabaseUrl = window.__SUPABASE_URL__ || '';
  const supabaseAnonKey = window.__SUPABASE_ANON_KEY__ || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    messageBox.textContent = 'Booking is not configured yet. Add your Supabase URL and anon key.';
    messageBox.classList.add('visible');
    return;
  }

  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });

  async function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.classList.add('visible');
    messageBox.style.color = isError ? '#b91c1c' : '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      date: form.elements.date.value,
      slot_time: form.elements.slot_time.value,
      service: form.elements.service.value,
      message: form.elements.message?.value?.trim?.() || ''
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.date || !payload.slot_time || !payload.service || !payload.message) {
      await showMessage('Please fill in all fields before reserving a slot.', true);
      return;
    }

    try {
      await showMessage('Reserving your session slot...');

      const { data, error } = await supabase.rpc('create_booking_hold', {
        p_name: payload.name,
        p_email: payload.email,
        p_phone: payload.phone,
        p_booking_date: payload.date,
        p_booking_time: payload.slot_time,
        p_service: payload.service,
        p_message: payload.message,
        p_hold_minutes: 10
      });

      if (error) {
        throw new Error(error.message || 'Unable to reserve your slot.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'This slot is no longer available.');
      }

      const holdId = data.hold_id;
      const confirmResult = await supabase.rpc('confirm_hold_after_payment', {
        p_hold_id: holdId,
        p_payment_status: 'succeeded'
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || 'Payment confirmation failed.');
      }

      await showMessage(`Reserved! Your session for ${payload.date} at ${payload.slot_time} is now confirmed.`, false);
      form.reset();
    } catch (err) {
      await showMessage(err.message || 'Could not complete booking.', true);
    }
  });
})();
