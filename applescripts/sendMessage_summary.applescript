-- sendMessage_summary.applescript
-- Sends a multi-paragraph summary to the Dingers group chat.
-- Usage: osascript sendMessage_summary.applescript "Dingers only" "summary text"

on run {targetName, targetMessage}
	tell application "Messages"
		try
			set targetChat to first chat whose name contains targetName
			send targetMessage to targetChat
		on error
			-- Fallback to individual buddy if group chat lookup fails
			set iService to 1st service whose service type = iMessage
			set targetBuddy to buddy targetName of iService
			send targetMessage to targetBuddy
		end try
	end tell
end run
