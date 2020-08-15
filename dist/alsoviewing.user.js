// ==UserScript==
// @name          WordPress.org Also Viewing
// @namespace     http://jason.stallin.gs
// @description   See when another person is viewing the same post.
// @include       https://*.wordpress.org/support/topic/*
// @include       https://*.wordpress.org/support/view/*
// @include       https://wordpress.org/support/topic/*
// @include       https://wordpress.org/support/view/*
// @require       https://code.jquery.com/jquery-1.11.0.min.js
// @require       https://viewing-server.herokuapp.com/socket.io/socket.io.js
// @version       0.9.0
// @resource      configHtml https://raw.githubusercontent.com/wporg-support/also-viewing/master/dist/options.html
// @updateURL     https://github.com/wporg-support/also-viewing/raw/master/dist/alsoviewing.user.js
// @downloadURL   https://github.com/wporg-support/also-viewing/raw/master/dist/alsoviewing.user.js
// @grant         GM_getResourceText
// ==/UserScript==

let socket,
	page,
	users,
	$username,
	username,
	settings = {
		isAnonymous: false
	},
	hasHadTyping = false,
	allowDirectPost = true,
	isTyping = false,
	viewToken = ( Math.random() + 1 ).toString(36).substring(2,5),
	NoLongerTyping;
$(document).on('ready', function()
{
	loadSettings();

	// Build the username and displaynames conditionally depending on what is available to us
	if ( $('.username').length < 1 ) {
		$username = $('.display-name').first();
	} else {
		$username = $('.username');
	}

	// Bail if we didn't find a username.
	if ( ! $username.length && ! settings.isAnonymous ) {
		return;
	}

	page = window.location.pathname;

	sendToServer();

	// Add options link to the sidebar.
	$( '.entry-meta.sidebar div:first-of-type ul' ).append( '<li><a href="#" id="tamper-show-also-viewing-options">Also Viewing Options</a></li>' );

	// Trigger options form display
	$( '.entry-meta' ).on( 'click', '#tamper-show-also-viewing-options', function( e ) {
		e.preventDefault();

		$( '#bbpress-forums' ).prepend( GM_getResourceText( 'configHtml' ) );

		$( '#tamper-wp-also-viewing-anonymize' ).prop( 'checked', settings.isAnonymous );
	});

	// Save options
	$( '#page' ).on( 'submit', '#temper-wp-also-viewing-options', function( e ) {
		e.preventDefault();

		settings.isAnonymous = $( '#tamper-wp-also-viewing-anonymize' ).is( ':checked');

		localStorage.setItem( 'wp_alsoviewing', JSON.stringify( settings ) );

		$( this ).remove();
	}).on( 'click', '.cancel', function( e ) {
		e.preventDefault();
		$( this ).closest( 'form' ).remove();
	});
});

function loadSettings() {
	let stored = localStorage.getItem( 'wp_alsoviewing' );

	if ( null !== stored ) {
		settings = JSON.parse( stored );
	}
}

function prepareUsername() {
	// Build the username.
	if (!settings.isAnonymous) {
		if ($('.username').length < 1) {
			username = $username.text();
		} else {
			username = $('.display-name').first().text();
		}

		// If the username isn't part of the displayname, append it.
		if (!username.includes($username.text())) {
			username = username + ' (' + $username.text() + ')';
		}
	} else {
		username = "{" + "anonymous_" + viewToken + "}";
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
						$("#main").before('<div id="viewing-top" style="font-size: 14px; color: #fff; line-height: 30px; font-family: Helvetica,sans-serif; background: #d54e21; border-bottom: 1px solid #dfdfdf; width:100%; height:30px; text-align: center; position: initial; top: 32px; left: 0; z-index: 9999;">Fnords are also viewing.</div>');
					}

					if ( userlist.length == 1 ) {
						userlistPretty = userlist.join( ", " );
					}
					else {
						userlistPretty = userlist.slice(0, -1).join(', ');
						userlistPretty = userlistPretty + ' and ' + userlist.slice(-1);
					}

					if ( userlistPretty.includes( '[Typing...]' ) ) {
						hasHadTyping = true;
						allowDirectPost = false;
					}

					$("#viewing-top").text( userlistPretty + " " + ending);

					if ( wp.a11y.speak ) {
						wp.a11y.speak( userlistPretty + " " + ending );
					}
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
$( 'body' ).on( 'submit', '#new-post', function( e ) {
	if ( allowDirectPost ) {
		return true;
	}

	e.preventDefault();

	allowDirectPost = true;

	let message = 'Another user has previously been working on a reply to this post, would you like to see any new replies first?';
	let buttonPost = '<button type="submit" class="button">Just post my reply</button>';
	let buttonShow = '<button type="button" id="reload-post-content" class="button button-primary">Show new replies</button>';

	$( '.bbp-submit-wrapper' )
		.css( 'margin-top', 'initial' )
		.css( 'float', 'none' )
		.html( message + '<br>' + buttonPost + '&nbsp;' + buttonShow );
} ).on( 'click', '#reload-post-content', function() {
	$.post(
		window.location.href
	).done(function(response) {
		let content = $( '.bbp-replies', response ).html();
		let pagination = $( '.bbp-pagination', response ).html();

		$( '.bbp-replies' ).html( content );
		$( '.bbp-pagination' ).html( pagination );
	}).fail(function(response) {
		let message = 'Could not look for new replies, please refresh the page manually.';
		let buttonPost = '<button type="submit" class="button button-primary">Just post my reply</button>';

		$( '.bbp-submit-wrapper' )
			.css( 'margin-top', 'initial' )
			.css( 'float', 'none' )
			.html( message + '<br>' + buttonPost );
	});
} );

function transmitIsTyping() {
	// Avoid re-transmitting repeatedly, we only need to do so on state changes.
	if ( isTyping ) {
		return;
	}

	isTyping = true;

	prepareUsername();

	reconnectSocker();
}

function transmitNoLongerTyping() {
	// Avoid re-transmitting repeatedly, we only need to do so on state changes.
	if ( ! isTyping ) {
		return;
	}

	isTyping = false;

	prepareUsername();

	reconnectSocker();
}

function reconnectSocker() {
	socket.disconnect();
	socket.connect();
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
