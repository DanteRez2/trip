(() => {
  const days = window.ITINERARY || [];
  const dateGroups = document.getElementById('dateGroups');
  const dayView = document.getElementById('dayView');
  const prevButton = document.getElementById('prevDay');
  const nextButton = document.getElementById('nextDay');
  const dayPosition = document.getElementById('dayPosition');
  const firstDayButton = document.getElementById('todayButton');
  let activeIndex = Number(localStorage.getItem('japanPlannerActiveDay') || 0);
  let openPlannerTab = null;
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= days.length) activeIndex = 0;

  const euro = value => Number(value) > 0 ? `€${Math.round(Number(value))}` : 'Free';
  const total = (items, key) => items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const storageJSON = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  };

  const tripEntryBudget = days.reduce((sum, day) => sum + total(day.items, 'cost'), 0);
  const hotels = storageJSON('japanPlannerHotels', {});
  const totalHotelBudget = () => Object.values(hotels).reduce((sum,h)=>sum + (Number(h?.price)||0),0);
  const reservations = storageJSON('japanPlannerReservations', {});


  function cityLabel(city) {
    return city.includes('/') ? city.split('/').pop().trim() : city;
  }

  function mapUrl(item, day) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${cityLabel(day.city)} Japan`)}`;
  }

  function reservationItems(day) {
    return day.items.filter(item => item.booking || Number(item.cost) > 10 || /museum|sky|universal|teamlab|train|shinkansen/i.test(item.name));
  }

  function buildDateNavigation() {
    dateGroups.innerHTML = '';
    const groups = [];
    days.forEach((day, index) => {
      const city = cityLabel(day.city);
      let group = groups.find(entry => entry.city === city);
      if (!group) { group = { city, days: [] }; groups.push(group); }
      group.days.push({ day, index });
    });

    groups.forEach(group => {
      const wrapper = document.createElement('div');
      wrapper.className = 'city-group';
      wrapper.innerHTML = `<p class="city-label">${escapeHtml(group.city.toUpperCase())}</p><div class="city-dates"></div>`;
      const row = wrapper.querySelector('.city-dates');
      group.days.forEach(({day, index}) => {
        const [weekday, number] = day.date.split(' ');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'date-button';
        button.dataset.index = index;
        button.setAttribute('aria-label', day.date + ' · ' + day.city);
        button.innerHTML = `<span><span class="date-number">${escapeHtml(number)}</span><span class="date-weekday">${escapeHtml(weekday)}</span></span>`;
        button.addEventListener('click', () => selectDay(index));
        row.appendChild(button);
      });
      dateGroups.appendChild(wrapper);
    });
  }

  function renderPlannerTools(day) {
    const city = day.hotelCity || cityLabel(day.city);
    const hotel = hotels[city] || {};
    const bookables = reservationItems(day);
    const completed = bookables.filter(item => reservations[item.id]).length;
    const tripTotal = tripEntryBudget + totalHotelBudget();
    const hb = document.getElementById('headerTripBudget');
    if (hb) hb.textContent = 'Trip Budget: ' + euro(tripTotal);

    const hotelPanel = `
      <div class="tool-body hotel-form" data-city="${escapeHtml(city)}">
        <label>Hotel name<input data-field="name" value="${escapeHtml(hotel.name || '')}" placeholder="Add hotel name"></label>
        <label>Address<input data-field="address" value="${escapeHtml(hotel.address || '')}" placeholder="Add address"></label>
        <label>Booking reference<input data-field="reference" value="${escapeHtml(hotel.reference || '')}" placeholder="Optional"></label>
        <label>Total hotel price (€)<input type="number" data-field="price" value="${escapeHtml(hotel.price || '')}" placeholder="0"></label>
        <div class="hotel-actions">
          <button type="button" class="save-hotel">Save hotel</button>
          <button type="button" class="hotel-options" onclick="window.location.href='hotels.html'">Hotel Options</button>
          ${hotel.address ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.address)}">Open map</a>` : ''}
        </div>
      </div>`;

    const reservationPanel = `
      <div class="tool-body reservation-list">
        ${bookables.length ? bookables.map(item => `
          <label class="reservation-row">
            <input type="checkbox" data-reservation="${escapeHtml(item.id)}" ${reservations[item.id] ? 'checked' : ''}>
            <span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.time)} · ${euro(item.cost)}</small></span>
          </label>`).join('') : '<p class="empty-state">No advance reservations identified for this day.</p>'}
      </div>`;

    return `
      <section class="planner-tools" aria-label="Trip planning tools">
        <div class="tool-card planning-card ${openPlannerTab ? 'is-open' : ''}">
          <div class="planning-tabs" role="tablist" aria-label="Hotel and reservations">
            <button type="button" class="planning-tab ${openPlannerTab === 'hotel' ? 'active' : ''}" data-planner-tab="hotel" role="tab" aria-selected="${openPlannerTab === 'hotel'}">
              <span>Hotel · ${escapeHtml(city)}</span><b>${hotel.name ? 'Saved' : ''}</b>
            </button>
            <button type="button" class="planning-tab ${openPlannerTab === 'reservations' ? 'active' : ''}" data-planner-tab="reservations" role="tab" aria-selected="${openPlannerTab === 'reservations'}">
              <span>Reservations</span><b>${completed}/${bookables.length || 0} </b>
            </button>
          </div>
          ${openPlannerTab ? `<div class="planning-content" role="tabpanel">${openPlannerTab === 'hotel' ? hotelPanel : reservationPanel}</div>` : ''}
        </div>
      </section>`;
  }

  function renderDay() {
    const day = days[activeIndex];
    const hero = day.items.find(item => item.photo)?.photo || '';
    const walking = total(day.items, 'walk');
    const cost = total(day.items, 'cost');
    const transit = total(day.items, 'transit');
    const duration = total(day.items, 'duration');
    let lastPeriod = '';

    const activities = day.items.map(item => {
      const hour = parseInt((item.time || '0').split(':')[0], 10) || 0;
      const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      const heading = period !== lastPeriod ? `<div class="period-title">${period}</div>` : '';
      lastPeriod = period;
      return `${heading}
        <article class="activity-card" id="activity-${escapeHtml(item.id)}">
          <img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}" loading="lazy">
          <div class="activity-content">
            <div class="activity-top">
              <div><div class="activity-time">${escapeHtml(item.time)}</div><h4>${escapeHtml(item.name)}</h4></div>
              <span class="core-badge">${item.core ? 'CORE' : 'OPTIONAL'}</span>
            </div>
            <p>${escapeHtml(item.desc)}</p>
            <div class="meta-row">
              <span>⏱ ${item.duration || 0} min</span><span>🚶 ${Number(item.walk || 0).toFixed(1)} km</span>
              <span>🚇 ${item.transit || 0} min</span><span>💶 ${euro(item.cost)}</span>
            </div>
            ${item.booking ? '<span class="booking-badge">BOOK AHEAD</span>' : ''}
            <div class="activity-details">
              ${item.tip ? `<div class="tip"><b>Tip:</b> ${escapeHtml(item.tip)}</div>` : ''}
              ${item.transport ? `<div class="transport"><b>Transport:</b> ${escapeHtml(item.transport)}</div>` : ''}
              <a class="maps-btn" target="_blank" rel="noopener" href="${mapUrl(item, day)}">Open in Google Maps</a>
            </div>
          </div>
        </article>`;
    }).join('');

    dayView.innerHTML = `
      <article class="day-hero">
        <img src="${escapeHtml(hero)}" alt="${escapeHtml(day.city)}" fetchpriority="high">
        <div class="hero-content">
          <div class="hero-date">${escapeHtml(day.date)}</div><div class="hero-city">${escapeHtml(day.city)}</div>
          <h2>${escapeHtml(day.title)}</h2><p class="hero-summary">${escapeHtml(day.summary)}</p>
          <div class="day-stats">
            <div class="stat"><span>Activities</span><b>${day.items.length}</b></div>
            <div class="stat"><span>Walking</span><b>${walking.toFixed(1)} km</b></div>
            <div class="stat"><span>Transit</span><b>${Math.round(transit)} min</b></div>
            <div class="stat"><span>Est. entries</span><b>${euro(cost)}</b></div>
          </div>
        </div>
      </article>
      ${renderPlannerTools(day)}
      <div class="section-title"><h3>Day plan</h3><span>${Math.round(duration / 60)} hr planned</span></div>
      <div class="activity-list">${activities}</div>`;

    document.querySelectorAll('.date-button').forEach(button => {
      const selected = Number(button.dataset.index) === activeIndex;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'date' : 'false');
      if (selected) button.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    });
    prevButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === days.length - 1;
    dayPosition.textContent = `Day ${activeIndex + 1} of ${days.length}`;
    localStorage.setItem('japanPlannerActiveDay', activeIndex);
  }

  function selectDay(index) {
    if (index < 0 || index >= days.length) return;
    activeIndex = index;
    openPlannerTab = null;
    renderDay();
    window.scrollTo({top: 0, behavior:'smooth'});
  }

  dayView.addEventListener('click', event => {
    const tabButton = event.target.closest('[data-planner-tab]');
    if (tabButton) {
      const tab=tabButton.dataset.plannerTab;
      openPlannerTab = (openPlannerTab===tab)?null:tab;
      renderDay();
      return;
    }
    const saveButton = event.target.closest('.save-hotel');
    if (saveButton) {
      const form = saveButton.closest('.hotel-form');
      const city = form.dataset.city;
      hotels[city] = {};
      form.querySelectorAll('[data-field]').forEach(input => hotels[city][input.dataset.field] = input.value.trim());
      localStorage.setItem('japanPlannerHotels', JSON.stringify(hotels));
      renderDay();
      return;
    }
    if (event.target.closest('a,button,input,label,summary,details')) return;
    const card = event.target.closest('.activity-card');
    if (!card) return;
    document.querySelectorAll('.activity-card.expanded').forEach(openCard => { if (openCard !== card) openCard.classList.remove('expanded'); });
    card.classList.toggle('expanded');
    if (card.classList.contains('expanded')) card.scrollIntoView({behavior:'smooth', block:'start'});
  });

  dayView.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-reservation]');
    if (!checkbox) return;
    reservations[checkbox.dataset.reservation] = checkbox.checked;
    localStorage.setItem('japanPlannerReservations', JSON.stringify(reservations));
    renderDay();
  });

  prevButton.addEventListener('click', () => selectDay(activeIndex - 1));
  nextButton.addEventListener('click', () => selectDay(activeIndex + 1));
  firstDayButton.addEventListener('click', () => selectDay(0));
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') selectDay(activeIndex - 1);
    if (event.key === 'ArrowRight') selectDay(activeIndex + 1);
  });

  buildDateNavigation();
  renderDay();
})();
