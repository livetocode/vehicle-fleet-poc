import os
import yaml
import time
import shutil
import subprocess

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

config = read_config()

step("build shared libraries...")
compile_nodejs_lib("shared/javascript/core-lib")
compile_nodejs_lib("shared/javascript/messaging-lib")

step("Cleanup data")
delete_folder("output")

processes = []
next_http_port = 7700;

step("Start collectors")
COLLECTOR_COUNT = config['collector']['instances']
for idx in range(COLLECTOR_COUNT):
    processes.append(start_background_nodejs_app("event-collector/nodejs", env = { 
        'COLLECTOR_INDEX': str(idx),
        'PATH': os.environ['PATH'],
        'NODE_HTTP_PORT': str(next_http_port),
    }))
    next_http_port += 1
print("Wait for collectors to be ready...")
time.sleep(2)
processes = [process for process in processes if process.poll() is None]
if not processes:
    raise Exception("Collectors failed to execute")

step("Start generators")
GENERATOR_COUNT = config['generator']['instances']
for idx in range(GENERATOR_COUNT):
    processes.append(start_background_nodejs_app("event-generator/nodejs", env = { 
        'GENERATOR_INDEX': str(idx), 
        'PATH': os.environ['PATH'],
        'NODE_HTTP_PORT': str(next_http_port),
    }))
    next_http_port += 1

wait_for_processes_to_complete(processes)

step("Execution complete")

if config['finder']['autoStart']:
    step("Start finders")
    FINDER_COUNT = config['finder']['instances']
    for idx in range(FINDER_COUNT):
        processes.append(start_background_nodejs_app("event-finder/nodejs", env = { 
            'FINDER_INDEX': str(idx),
            'PATH': os.environ['PATH'],
            'NODE_HTTP_PORT': str(next_http_port),
        }))
        next_http_port += 1

    wait_for_processes_to_complete(processes)


