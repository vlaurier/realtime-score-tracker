// public/notify.js

function showNotification(message, options = {}) {
  const duration = options.duration || 2500;
  const background = options.background || '#d4edda';
  const color = options.color || '#155724';
  const border = options.border || '#c3e6cb';

  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '1rem';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.background = background;
  notification.style.color = color;
  notification.style.padding = '1rem';
  notification.style.border = `1px solid ${border}`;
  notification.style.borderRadius = '5px';
  notification.style.fontWeight = 'bold';
  notification.style.zIndex = '9999';
  notification.style.opacity = '1';
  notification.style.transition = 'opacity 1s ease';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 1000);
  }, duration);
}
