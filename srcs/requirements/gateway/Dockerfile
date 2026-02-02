FROM python:3.13-slim

# TODO useful for debugging, might want to remove this later...
RUN apt update && apt install -y curl net-tools

WORKDIR /src

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]