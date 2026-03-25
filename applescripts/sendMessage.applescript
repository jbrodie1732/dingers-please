-- sendMessage.applescript
-- Sends a single iMessage to the Dingers group chat or an individual phone number.
-- Usage: osascript sendMessage.applescript "message text here"
--
-- Set IMESSAGE_GROUP_CHAT in your .env to either:
--   - A group chat name:  "Dingers only"
--   - A phone number:     "+13105551234"  (for testing before group chat exists)

on run argv
	set messageText to item 1 of argv
	set chatTarget to item 2 of argv

	tell application "Messages"
		set iService to 1st service whose service type = iMessage
		try
			-- Try group chat by name first
			set targetChat to first chat whose name contains chatTarget
			send messageText to targetChat
		on error
			-- Fall back to phone number / individual buddy
			set targetBuddy to buddy chatTarget of iService
			send messageText to targetBuddy
		end try
	end tell
end run
