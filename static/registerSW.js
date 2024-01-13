/*
 Solely for unregistering the old service worker used in the legacy version of the app.
 This is necessary because the user may have the old service worker cached, and if so,
 it would prevent the new service worker from registering.
*/

if ('serviceWorker'in navigator) {
    window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('./sw.js', {
            scope: './'
        })
    }
    )
}
