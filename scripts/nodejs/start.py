import os
import yaml
import time
import shutil
import requests
import subprocess
from collections import deque

next_http_port = 7700

service_runtimes = {
    "event-collector": "nodejs",
    "event-generator": "nodejs",
    "event-finder": "rust" # nodejs, rust
}

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

def start_background_rust_app(folder: str, env):
    result = subprocess.Popen(["cargo run --release"], shell=True, cwd=folder, env=env)
    return result

def delete_folder(folder: str):
    if os.path.exists(folder):
        print(f"deleting '{folder}'...")
        shutil.rmtree(folder)

def kill_processes(processes):
    for process in processes:
        if process.poll() is None:
            print(f"killing process {process.pid}")
            process.kill()

def wait_for_processes_to_complete(processes):
    while processes:
        processes = [process for process in processes if process.poll() is None]
        if processes:
            time.sleep(0.1)

def wait_for_instances_to_be_ready(instances):
    pids = [process.pid for process, _ in instances]
    print(f"Waiting for pids: {pids}")
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
    
def start_instances(folder: str, instances: int, process_starter):
    global next_http_port
    services = []
    for idx in range(instances):
        process = process_starter(folder, env = { 
            'INSTANCE_INDEX': str(idx),
            'PATH': os.environ['PATH'],
            'NODE_HTTP_PORT': str(next_http_port),
            'VEHICLES_AZURE_STORAGE_CONNECTION_STRING': os.environ['VEHICLES_AZURE_STORAGE_CONNECTION_STRING']
        })
        services.append((process, next_http_port))
        next_http_port += 1
    wait_for_instances_to_be_ready(services)
    return services

def start_nodejs_instances(folder: str, instances: int):
    return start_instances(folder, instances, start_background_nodejs_app)

def start_rust_instances(folder: str, instances: int):
    return start_instances(folder, instances, start_background_rust_app)

config = read_config()

step("build shared libraries...")
compile_nodejs_lib("shared/javascript/core-lib")
compile_nodejs_lib("shared/javascript/data-lib")
compile_nodejs_lib("shared/javascript/messaging-lib")

step("Cleanup data")
delete_folder("output")

services = []
try:
    step("Start collectors")
    services += start_nodejs_instances("event-collector/nodejs", config['collector']['instances'])

    step("Start generators")
    services += start_nodejs_instances("event-generator/nodejs", config['generator']['instances'])

    step("Start finders")
    if service_runtimes.get("event-finder", "nodejs") == "rust":
        services += start_rust_instances("event-finder/rust", config['finder']['instances'])
    else:
        services += start_nodejs_instances("event-finder/nodejs", config['finder']['instances'])

    print("")
    print("Waiting for processes to complete...")
    print([http_port for _, http_port in services])
    wait_for_processes_to_complete([process for process, _ in services])
except Exception as e:
    print(e)
    kill_processes([process for process, _ in services])
