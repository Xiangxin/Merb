
_.templateSettings = {
    interpolate: /\{\{=(.+?)\}\}/g,
    escape: /\{\{-(.+?)\}\}/g,
    evaluate: /\{\{(.+?)\}\}/g,
};

 
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // check if this cookie string begin with the name we want
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }   
    }
    return cookieValue;
}

function userLoggedIn() {
    var token = getCookie('token');
    if (token == "" || token == null) {
        return false;
    }
    return true;
}

function changePreview(ev, el) {
    var input = ev.target;
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                el.attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
}