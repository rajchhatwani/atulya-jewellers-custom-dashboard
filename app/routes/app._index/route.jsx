import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query {
        collections(first: 50) {
          edges {
            node {
              id
              title
              image {
                url
                altText
              }
              productsCount {
                count
              }
              products(first: 250) {
                edges {
                  node {
                    id
                    totalInventory
                  }
                }
              }
            }
          }
        }
      }`,
  );

  const data = await response.json();

  const collections = data.data.collections.edges.map(({ node }) => {
    const activeProducts = node.products.edges.filter(
      ({ node: product }) => product.totalInventory > 0,
    ).length;

    return {
      id: node.id,
      title: node.title,
      image: node.image,
      totalProducts: node.productsCount.count,
      activeProducts,
    };
  });

  return { collections };
}

export default function CollectionsPage() {
  const { collections } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page title="Product Collections">
      <Layout>
        <Layout.Section>
          {collections.length === 0 ? (
            <Card>
              <EmptyState
                heading="No collections found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Create some collections in your Shopify store to see them
                  here.
                </p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <ResourceList
                resourceName={{ singular: "collection", plural: "collections" }}
                items={collections}
                renderItem={(item) => {
                  const {
                    id,
                    title,
                    image,
                    activeProducts,
                    // totalProducts
                  } = item;
                  const collectionGid = id.split("/").pop();

                  return (
                    <ResourceItem
                      id={id}
                      accessibilityLabel={`View products in ${title}`}
                      onClick={() =>
                        navigate(`/app/collections/${collectionGid}`)
                      }
                      media={
                        <Thumbnail
                          source={
                            image?.url ||
                            "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                          }
                          alt={image?.altText || title}
                          size="medium"
                        />
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <Text variant="bodyMd" fontWeight="bold" as="h3">
                            {title}
                          </Text>
                          <div style={{ marginTop: "4px" }}>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {activeProducts} total products
                            </Text>
                          </div>
                        </div>
                        <Badge status="success">
                          {activeProducts} in stock
                        </Badge>
                      </div>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
