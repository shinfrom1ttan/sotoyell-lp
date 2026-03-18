// ===== FAQ Accordion =====
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    // Close all others
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-answer').style.maxHeight = '0';
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      }
    });

    // Toggle current
    if (isOpen) {
      item.classList.remove('open');
      answer.style.maxHeight = '0';
      button.setAttribute('aria-expanded', 'false');
    } else {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      button.setAttribute('aria-expanded', 'true');
    }
  });
});

// ===== Scroll Animations (Intersection Observer) =====
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger animation for grid items
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay * 100);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  const animatedElements = document.querySelectorAll(
    '.result-card, .feature-block, .testimonial-card, .team-card, .pricing-card, .pain-card'
  );

  animatedElements.forEach((el, index) => {
    // Add stagger delay for grid siblings
    const siblings = el.parentElement.children;
    const siblingIndex = Array.from(siblings).indexOf(el);
    el.dataset.delay = siblingIndex;
    observer.observe(el);
  });
}

// ===== Smooth Scroll for anchor links =====
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const headerHeight = document.querySelector('.header').offsetHeight;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== Form Submission to Google Apps Script =====
const trialForm = document.getElementById('trial-form');
if (trialForm) {
  trialForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('form-status');
    const submitBtn = trialForm.querySelector('.form-submit');
    const originalText = submitBtn.textContent;

    submitBtn.textContent = '送信中...';
    submitBtn.disabled = true;
    status.className = 'form-status';
    status.style.display = 'none';

    const formData = {
      companyName: trialForm.company.value,
      name: trialForm.name.value,
      phone: trialForm.phone.value,
      email: trialForm.email.value,
      message: trialForm.message.value
    };

    try {
      await fetch('https://script.google.com/macros/s/AKfycbx23mZV_tBAyTSKNrz2Vu3jQMe-V_QWAaRdzBpjTAM44bMtH-T4Pz33pCmuEzYfr8ZZ/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      status.textContent = 'お申込みありがとうございます。担当者よりご連絡いたします。';
      status.className = 'form-status success';
      trialForm.reset();
    } catch (err) {
      status.textContent = '送信に失敗しました。お手数ですがもう一度お試しください。';
      status.className = 'form-status error';
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}
