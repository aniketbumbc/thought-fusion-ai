import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
org = client.beta.organization.retrieve()
print(org.id, org.name)
