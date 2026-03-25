-- sendMessage.applescript
-- Sends a single iMessage to the Dingers group chat.
-- Usage: osascript sendMessage.applescript "message text here"

on run argv
	set messageText to item 1 of argv
	set chatName to (system attribute "IMESSAGE_GROUP_CHAT")

	-- Fallback to hardcoded name if env var not available via osascript
	if chatName is "" or chatName is missing value then
		set chatName to "Dingers only"
	end if

	tell application "Messages"
		set targetChat to first chat whose name contains chatName
		send messageText to targetChat
	end tell
end run
