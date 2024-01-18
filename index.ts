import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const config = new pulumi.Config()

interface vpc {
    vpc_name: string;
    vpc_cidr: string;
    azs: string[];
    pub_sub_cidrs: string[];
    priv_sub_cidrs: string[];
}


interface yourDetails {
    yourIP: string;
    yourAccessKey: string;
}


// define objects from config file
const vpc = config.requireObject<vpc>("vpc")


// ----NETWORKING----
// create VPC
const main = new aws.ec2.Vpc("main-vpc", {
    cidrBlock: vpc.vpc_cidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: `${pulumi.getProject()}-${vpc.vpc_name}`,
        ManagedBy: "Pulumi"
    }
})


// create pub subs
const pub_subs = vpc.pub_sub_cidrs.map((subnet, index) => {
    return new aws.ec2.Subnet(`pub_sub${index + 1}`, {
        cidrBlock: vpc.pub_sub_cidrs[index],
        vpcId: main.id,
        availabilityZone: vpc.azs[index],
        mapPublicIpOnLaunch:true,
        tags: {
            Name: `${pulumi.getProject()}-pub-sub${index + 1}`,
            ManagedBy: "Pulumi"
        }
    })
})


// create priv subs
const priv_subs = vpc.priv_sub_cidrs.map((subnet, index) => {
    return new aws.ec2.Subnet(`priv_sub${index + 1}`, {
        cidrBlock: vpc.priv_sub_cidrs[index],
        vpcId: main.id,
        availabilityZone: vpc.azs[index],
        mapPublicIpOnLaunch: false,
        tags: {
            Name: `${pulumi.getProject()}-priv-sub${index + 1}`,
            ManagedBy: "Pulumi"
        }
    })
})


// create ig
const ig = new aws.ec2.InternetGateway("main-ig", {
    vpcId: main.id,
    tags: {
        Name: `${pulumi.getProject()}-ig`,
        ManagedBy: "Pulumi"
    }
})


// create rt
const pub_rt = new aws.ec2.RouteTable("pub_rt", {
    vpcId: main.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: ig.id,
        }],
    tags: {
        Name: `${pulumi.getProject()}-rt`,
        ManagedBy: "Pulumi"
    }
});

// rt associations
const rt_associate = pub_subs.map((subnet, index) => {
    return new aws.ec2.RouteTableAssociation(`rt_associate-${index+1}`, {
        subnetId: subnet.id,
        routeTableId: pub_rt.id
    })
})


// exports:
export const vpc_export = main 