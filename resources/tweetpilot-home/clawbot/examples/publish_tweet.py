"""Example: publish a tweet with optional explicit instance routing."""

from clawbot import ClawBotClient
from multi_instance_example import resolve_instance_id

client = ClawBotClient()
instance_id = resolve_instance_id(client)
result = client.x.actions.create_tweet("Hello from clawbot library", instance_id=instance_id)
print(f"instance_id: {instance_id}")
print(result)
