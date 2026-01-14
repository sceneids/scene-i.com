// Lightweight client-side router with prefetching
(function() {
  'use strict';
  
  const cache = new Map();
  const prefetchDelay = 100; // ms delay before prefetching on hover
  
  // Get page path from URL
  function getPath(url) {
    const a = document.createElement('a');
    a.href = url;
    return a.pathname || '/';
  }
  
  // Check if URL is internal
  function isInternal(url) {
    const a = document.createElement('a');
    a.href = url;
    return a.hostname === window.location.hostname || !a.hostname;
  }
  
  // Fetch and cache page
  async function fetchPage(url) {
    if (cache.has(url)) {
      return cache.get(url);
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract main content
      const content = doc.body.innerHTML;
      const title = doc.title;
      
      const pageData = { content, title };
      cache.set(url, pageData);
      return pageData;
    } catch (error) {
      console.error('Error fetching page:', error);
      // Fallback to normal navigation
      window.location.href = url;
      return null;
    }
  }
  
  // Prefetch page on hover
  function prefetchPage(url) {
    if (!cache.has(url) && isInternal(url)) {
      fetchPage(url).catch(() => {}); // Silently fail prefetch
    }
  }
  
  // Navigate to page
  async function navigate(url, pushState = true) {
    if (!isInternal(url)) {
      window.location.href = url;
      return;
    }
    
    const path = getPath(url);
    
    // Fetch page
    const pageData = await fetchPage(url);
    if (!pageData) return;
    
    // Update content (fetched page already has all its elements)
    document.body.innerHTML = pageData.content;
    document.title = pageData.title;
    
    // Update active link after content update
    setTimeout(() => {
      document.querySelectorAll('nav a, a[data-nav]').forEach(link => {
        link.classList.remove('active');
        const linkPath = getPath(link.href);
        if (linkPath === path || link.getAttribute('href') === url || 
            (path === '/' && linkPath.includes('index.html')) ||
            (path.includes('index.html') && linkPath === '/')) {
          link.classList.add('active');
        }
      });
    }, 0);
    
    // Update URL
    if (pushState) {
      window.history.pushState({ path }, '', url);
    }
    
    // Reinitialize page scripts
    initPage();
    
    // Scroll to top
    window.scrollTo(0, 0);
  }
  
  // Initialize page-specific scripts
  function initPage() {
    // Reinitialize any page-specific functionality
    const scripts = document.querySelectorAll('script[data-init]');
    scripts.forEach(script => {
      try {
        // Create new script element to execute
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
        document.body.removeChild(newScript);
      } catch (e) {
        console.error('Error initializing script:', e);
      }
    });
    
    // Reinitialize lazy loading
    initLazyLoading();
  }
  
  // Initialize lazy loading for images
  function initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            }
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px'
      });
      
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback for older browsers
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }
  
  // Initialize navigation (using event delegation, only called once)
  function initNavigation() {
    // Intercept link clicks (event delegation - works for dynamically added links)
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Check if external or has target="_blank"
      if (link.target === '_blank' || !isInternal(href)) {
        return;
      }
      
      e.preventDefault();
      navigate(href);
    });
    
    // Prefetch on hover (event delegation)
    document.addEventListener('mouseenter', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (href && isInternal(href) && !href.startsWith('#')) {
        const timeout = setTimeout(() => {
          prefetchPage(href);
        }, prefetchDelay);
        
        link.addEventListener('mouseleave', () => {
          clearTimeout(timeout);
        }, { once: true });
      }
    }, true);
    
    // Handle browser back/forward (only add once)
    if (!window._routerPopStateInitialized) {
      window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
          navigate(window.location.pathname, false);
        } else {
          window.location.reload();
        }
      });
      window._routerPopStateInitialized = true;
    }
  }
  
  // Prefetch all navigation links on page load
  function prefetchNavLinks() {
    document.querySelectorAll('nav a, a[data-nav]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && isInternal(href) && !href.startsWith('#')) {
        // Prefetch after a short delay to not block initial load
        setTimeout(() => prefetchPage(href), 2000);
      }
    });
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initNavigation();
      initLazyLoading();
      prefetchNavLinks();
    });
  } else {
    initNavigation();
    initLazyLoading();
    prefetchNavLinks();
  }
})();

