import os
import yaml
import time
import shutil
import requests
import subprocess
from collections import deque

next_http_port = 7800;

def read_config():
    with open('config.yaml', 'r') as file:
        return yaml.safe_load(file)

def step(message: str):
    print()
    print(f"---------------------------< {message} >------------------------------------")

def compile_nodejs_lib(folder: str):
    subprocess.run(["npm", "run", "compile"], cwd=folder)

def start_nodejs_app(folder: str):
    subprocess.run(["npm", "start"], cwd=folder)

def start_background_nodejs_app(folder: str, env):
    result = subprocess.Popen(["npm start"], shell=True, cwd=folder, env=env)
    return result

def delete_folder(folder: str):
    if os.path.exists(folder):
        print(f"deleting '{folder}'...")
        shutil.rmtree(folder)

def wait_for_processes_to_complete(processes):
    while processes:
        processes = [process for process in processes if process.poll() is None]
        if processes:
            time.sleep(0.1)

def wait_for_instances_to_be_ready(instances):
    time.sleep(1)
    current_instances = deque(instances)
    while current_instances:
        process, http_port = current_instances.popleft()
        if process.poll() is not None:
            raise Exception(f"Instance localhost:{http_port} exited with {process.returncode}")
        try:
            print(f"pinging http://localhost:{http_port}...")
            requests.get(f"http://localhost:{http_port}/ping")
            print("   ping succeeded")
        except:
            print("   ping failed")
            current_instances.append((process, http_port))
            time.sleep(0.2)
    print("All instances are ready")

def start_nodejs_instances(folder: str, instances: int):
    global next_http_port
    services = []
    for idx in range(instances):
        process = start_background_nodejs_app(folder, env = { 
            'INSTANCE_INDEX': str(idx),
            'PATH': os.environ['PATH'],
            'NODE_HTTP_PORT': str(next_http_port),
        })
        services.append((process, next_http_port))
        next_http_port += 1
    wait_for_instances_to_be_ready(services)
    return services

config = read_config()

step("build shared libraries...")
compile_nodejs_lib("shared/javascript/core-lib")
compile_nodejs_lib("shared/javascript/messaging-lib")

step("Cleanup data")
delete_folder("output")

services = []

step("Start collectors")
services += start_nodejs_instances("event-collector/nodejs", config['collector']['instances'])

step("Start generators")
services += start_nodejs_instances("event-generator/nodejs", config['generator']['instances'])

step("Start finders")
services += start_nodejs_instances("event-finder/nodejs", config['finder']['instances'])

print("")
print("Waiting for processes to complete...")
print([http_port for _, http_port in services])
wait_for_processes_to_complete([process for process, _ in services])
