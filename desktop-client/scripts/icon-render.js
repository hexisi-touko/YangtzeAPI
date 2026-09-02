const logo = new URLSearchParams(window.location.search).get('logo')
if (logo) document.querySelector('#icon-source').src = logo
