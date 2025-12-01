from openai import OpenAI
from pydantic import BaseModel


class ProductReview(BaseModel):
    rating: int
    review_text: str
    review_title: str
    nickname: str


def get_completion_from_openai(prompt, model="gpt-5", format="text"):
    """Return the completion text for the given prompt using the appropriate OpenAI API."""
    client = OpenAI()
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        reasoning_effort="minimal",
        response_format=format,
    )
    message = completion.choices[0].message.content
    return message if isinstance(message, str) else message or ""


def get_structured_completion_from_openai(prompt, model="gpt-5", format=ProductReview):
    """Return the completion text for the given prompt using the appropriate OpenAI API."""
    client = OpenAI()
    completion = client.chat.completions.parse(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        reasoning_effort="minimal",
        response_format=format,
    )
    return completion.choices[0].message.parsed
