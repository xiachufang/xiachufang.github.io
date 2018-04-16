// By: h01000110 (hi)
// github.com/h01000110

function maximize () {
	var post = document.getElementsByClassName("content")[0];
	var cont = document.getElementsByClassName("post_content")[0];
	var wid = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName("body")[0].clientWidth;

	if (wid > 900) {
		widf = wid * 0.9;
		post.style.width = widf + "px";

		if (wid < 1400) {
			cont.style.width = "99%";
		} else {
			cont.style.width = "99.4%";
		}
	}
}

function minimize () {
	var post = document.getElementsByClassName("content")[0];
	var cont = document.getElementsByClassName("post_content")[0];
	var wid = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName("body")[0].clientWidth;

	if ( wid > 900 ) {
		post.style.width = "800px";
		cont.style.width = "98.5%";
	}
}

function close () {
	location.href = "/";
}

var btnmax = document.getElementsByClassName("btn-max")[0];
var btnmin = document.getElementsByClassName("btn-min")[0];
var btnclose = document.getElementsByClassName("btn-close")[0];

btnmax.addEventListener('click', maximize, false);
btnmin.addEventListener('click', minimize, false);
btnclose.addEventListener('click', close, false);
