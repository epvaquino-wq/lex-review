/**
 * LexReview - Hash Router
 * Simple hash-based routing for single-page navigation.
 */

const Router = (() => {
  const routes = {};
  let currentRoute = null;

  function register(hash, handler) {
    routes[hash] = handler;
  }

  function navigate(hash) {
    if (window.location.hash !== '#' + hash) {
      window.location.hash = hash;
    } else {
      _handleRoute();
    }
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  function _handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    currentRoute = hash;

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkHash = link.getAttribute('data-route');
      link.classList.toggle('active', linkHash === hash);
    });

    // Hide mobile nav on navigate
    const nav = document.querySelector('.nav-menu');
    if (nav) nav.classList.remove('open');

    // Execute route handler
    if (routes[hash]) {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.style.opacity = '0';
        mainContent.style.transform = 'translateY(8px)';
        setTimeout(() => {
          routes[hash]();
          mainContent.style.opacity = '1';
          mainContent.style.transform = 'translateY(0)';
        }, 150);
      } else {
        routes[hash]();
      }
    }
  }

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    // Set up nav click handlers
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        navigate(route);
      });
    });
    // Initial route
    _handleRoute();
  }

  return {
    register,
    navigate,
    getCurrentRoute,
    init
  };
})();
