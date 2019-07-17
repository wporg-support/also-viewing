// ==UserScript==
// @name          WordPress.org Also Viewing
// @namespace     http://jason.stallin.gs
// @description   See when another person is viewing the same post.
// @grant         none
// @include       https://*.wordpress.org/support/topic/*
// @include       https://*.wordpress.org/support/view/*
// @include       https://wordpress.org/support/topic/*
// @include       https://wordpress.org/support/view/*
// @require       https://code.jquery.com/jquery-1.11.0.min.js
// @require       https://viewing-server.herokuapp.com/socket.io/socket.io.js
// @version       0.0.8.1
// @updateURL     https://github.com/wporg-support/also-viewing/raw/master/src/alsoviewing.user.js
// @downloadURL   https://github.com/wporg-support/also-viewing/raw/master/src/alsoviewing.user.js
// ==/UserScript==

var socket,
	page,
	users,
	$username,
	username,
	isTyping = false,
	NoLongerTyping;
$(document).on('ready', function()
{
	// Build the username and displaynames conditionally depending on what is available to us
	if ( $('.username').length < 1 ) {
		$username = $('.display-name').first();
	} else {
		$username = $('.username');
	}

	// Bail if we didn't find a username.
	if (!$username.length)
	{
		return;
	}

	page = window.location.pathname;

	sendToServer();
});

function prepareUsername() {
	// Build the username.
	if ( $('.username').length < 1 ) {
		username = $username.text();
	} else {
		username = $('.display-name').first().text() + ' (' + $username.text() + ')';
	}

	if ( isTyping ) {
		username = username + ' [Typing...]';
	}
}

function sendToServer() {
	prepareUsername();

	socket = io("https://viewing-server.herokuapp.com");

	socket.on('connect', function()
	{
		socket.emit('pageopened',
			{
				username: username,
				page: page
			});

		socket.on(page, function(data)
		{
			if (data.length > 1)
			{
				var userlist = [];
				var userlistPretty = '';
				var ending = "";
				var flag = 0;
				for (var x in data)
				{
					if (data[x].username != username && typeof data[x].username != "undefined")
					{
						//Other users exist!
						flag = 1;
						userlist.push(data[x].username);
					}
				}

				//Fixes duplicate usernames.
				userlist = userlist.getUnique();

				$("#viewing-top").text("");

				if (userlist.length == 1)
				{
					ending = "is also viewing this page.";
				}
				else
				{
					ending = "are also viewing this page.";
				}
				if (flag == 1)
				{
					if (!$("#viewing-top")[0])
					{
						$("#pagebody").css('margin-top', '50px');
						$("#main").before('<div id="viewing-top" style="font-size: 14px; color: #fff; line-height: 30px; font-family: Helvetica,sans-serif; background: #d54e21; border-bottom: 1px solid #dfdfdf; width:100%; height:30px; text-align: center; position: initial; top: 32px; left: 0; z-index: 9999;">Jason Stallings is also viewing.</div>');
					}

					if ( userlist.length == 1 ) {
						userlistPretty = userlist.join( ", " );
					}
					else {
						userlistPretty = userlist.slice(0, -1).join(', ');
						userlistPretty = userlistPretty + ' and ' + userlist.slice(-1);
					}

					$("#viewing-top").text( userlistPretty + " " + ending);
				}
			}
			else
			{
				$("#pagebody").css('margin-top', '29px');
				$("#viewing-top").remove();
			}
			users = data;
		});
	});
}

$(window).scroll( function() {
	var $view_bar = $("#viewing-top");
	if ( $view_bar.length < 1 ) {
		return;
	}

	if ( $(window).scrollTop() > 200 ) {
		$view_bar.css('position', 'fixed');
	} else {
		$view_bar.css('position', 'initial');
	}
});

$( '#bbp_reply_content' ).keydown(function() {
	// Bail if we didn't find a username.
	if (!$username.length)
	{
		return;
	}

	transmitIsTyping();

	clearInterval( NoLongerTyping );

	NoLongerTyping = setInterval(function() {
		transmitNoLongerTyping();
	}, 15000 );
});

function transmitIsTyping() {
	// Avoid re-transmitting repeatedly, we only need to do so on state changes.
	if ( isTyping ) {
		return;
	}

	isTyping = true;

	prepareUsername();

	socket.disconnect();
	socket.connect();

	//sendToServer();
}

function transmitNoLongerTyping() {
	// Avoid re-transmitting repeatedly, we only need to do so on state changes.
	if ( ! isTyping ) {
		return;
	}

	isTyping = false;

	prepareUsername();

	socket.disconnect();
	socket.connect();

	//sendToServer();
}

//From: http://stackoverflow.com/a/1961068/2233771
Array.prototype.getUnique = function()
{
	var u = {},
		a = [];
	for (var i = 0, l = this.length; i < l; ++i)
	{
		if (u.hasOwnProperty(this[i]))
		{
			continue;
		}
		a.push(this[i]);
		u[this[i]] = 1;
	}
	return a;
};
