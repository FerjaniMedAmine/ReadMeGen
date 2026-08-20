from getpass import getpass

from security import hash_password


password = getpass("Enter the admin password: ")
confirmation = getpass("Confirm the admin password: ")

if password != confirmation:
    raise ValueError("Passwords do not match.")

if len(password) < 8:
    raise ValueError("Password must contain at least 8 characters.")

hashed_password = hash_password(password)

print("\nCopy this password hash:\n")
print(hashed_password)